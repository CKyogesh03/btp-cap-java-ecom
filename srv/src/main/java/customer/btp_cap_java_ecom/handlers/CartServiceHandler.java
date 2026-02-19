package customer.btp_cap_java_ecom.handlers;

import java.math.BigDecimal;
import java.util.*;
import java.util.stream.Collectors;

import org.springframework.boot.autoconfigure.amqp.RabbitConnectionDetails.Address;
import org.springframework.stereotype.Component;

import com.sap.cds.CdsResult;
import com.sap.cds.Result;
import com.sap.cds.ql.CdsName;
import com.sap.cds.ql.Delete;
import com.sap.cds.ql.Insert;
import com.sap.cds.ql.Select;
import com.sap.cds.ql.Update;
import com.sap.cds.services.EventContext;
import com.sap.cds.services.environment.CdsProperties.Persistence.PersistenceServiceConfig;
import com.sap.cds.services.handler.EventHandler;
import com.sap.cds.services.handler.annotations.On;
import com.sap.cds.services.handler.annotations.ServiceName;
import com.sap.cds.services.persistence.PersistenceService;

import cds.gen.ActionResponse;
import cds.gen.AddToCartResponse;
import cds.gen.com.practice.ecommerce.Addresses;
import cds.gen.com.practice.ecommerce.Addresses_;
import cds.gen.com.practice.ecommerce.CartItems;
import cds.gen.com.practice.ecommerce.CartItems_;
import cds.gen.com.practice.ecommerce.Carts;
import cds.gen.com.practice.ecommerce.Carts_;
import cds.gen.com.practice.ecommerce.Customers;
import cds.gen.com.practice.ecommerce.OrderItems;
import cds.gen.com.practice.ecommerce.Products;
import cds.gen.com.practice.ecommerce.Products_;
import cds.gen.com.practice.ecommerce.Stocks;
import cds.gen.com.practice.ecommerce.Stocks_;
import cds.gen.ecommerceservice.AddToCartContext;
import cds.gen.ecommerceservice.CanCustomerReviewContext;
import cds.gen.ecommerceservice.GetCustomerCartContext;
import cds.gen.ecommerceservice.Orders;
import cds.gen.ecommerceservice.Orders_;
import cds.gen.ecommerceservice.PlaceOrderContext;
import cds.gen.ecommerceservice.GetCustomerCartContext.ReturnType;
import cds.gen.com.practice.ecommerce.OrderItems_;

@Component
@ServiceName("EcommerceService")
public class CartServiceHandler implements EventHandler {

        private final PersistenceService db;

        public CartServiceHandler(PersistenceService db) {
                this.db = db;
        }

        @On(event = "getCustomerCart")
        public void getCustomerCart(GetCustomerCartContext context) {

                String customerId = context.getCustomerId();

                // ------------------------------------------------
                // 1️⃣ Find the cart for this customer
                // ------------------------------------------------
                Optional<Carts> cartOpt = db.run(
                                Select.from(Carts_.class)
                                                .where(c -> c.customer_ID().eq(customerId)))
                                .first();

                if (cartOpt.isEmpty()) {
                        context.setResult(emptyCart());
                        return;
                }

                String cartId = cartOpt.get().getId();

                // ------------------------------------------------
                // 2️⃣ Load cart items (NO product join yet)
                // ------------------------------------------------
                List<CartItems> cartItems = db.run(
                                Select.from(CartItems_.class)
                                                .where(i -> i.cart_ID().eq(cartId)))
                                .listOf(CartItems.class);

                if (cartItems.isEmpty()) {
                        context.setResult(emptyCart());
                        return;
                }

                // ------------------------------------------------
                // 3️⃣ Collect product IDs from cart items
                // ------------------------------------------------
                Set<String> productIds = cartItems.stream()
                                .map(ci -> (String) ci.get("product_ID"))
                                .filter(Objects::nonNull)
                                .collect(Collectors.toSet());

                // ------------------------------------------------
                // 4️⃣ Load all Products in ONE query
                // ------------------------------------------------
                Map<String, Products> productMap = db.run(
                                Select.from(Products_.class)
                                                .where(p -> p.ID().in(productIds)))
                                .listOf(Products.class)
                                .stream()
                                .collect(Collectors.toMap(Products::getId, p -> p));

                // ------------------------------------------------
                // 5️⃣ Hydrate CartItems → Product association
                // ------------------------------------------------
                for (CartItems ci : cartItems) {
                        String productId = (String) ci.get("product_ID");
                        Products p = productMap.get(productId);
                        ci.setProduct(p);
                }

                // ------------------------------------------------
                // 6️⃣ Build API response
                // ------------------------------------------------
                BigDecimal total = BigDecimal.ZERO;
                List<GetCustomerCartContext.ReturnType.Items> items = new ArrayList<>();

                for (CartItems ci : cartItems) {

                        Products product = ci.getProduct();

                        if (product == null) {
                                continue; // Safety: if orphaned FK exists
                        }

                        BigDecimal price = product.getPrice();
                        int qty = ci.getQuantity();
                        BigDecimal lineTotal = price.multiply(BigDecimal.valueOf(qty));

                        total = total.add(lineTotal);

                        var item = GetCustomerCartContext.ReturnType.Items.create();
                        item.setId(ci.getId());
                        item.setProductName(product.getName());
                        item.setImageUrl(product.getImageUrl());
                        item.setUnitPrice(price);
                        item.setQuantity(qty);
                        item.setTotalPrice(lineTotal);

                        items.add(item);
                }

                BigDecimal delivery = total.compareTo(new BigDecimal("500")) >= 0
                                ? BigDecimal.ZERO
                                : new BigDecimal("50");

                var result = GetCustomerCartContext.ReturnType.create();
                result.setItems(items);
                result.setTotalAmount(total);
                result.setDeliveryCost(delivery);

                context.setResult(result);
        }

        private GetCustomerCartContext.ReturnType emptyCart() {
                ReturnType r = GetCustomerCartContext.ReturnType.create();
                r.setItems(List.of());
                r.setTotalAmount(BigDecimal.ZERO);
                r.setDeliveryCost(BigDecimal.ZERO);
                return r;
        }

        @On(event = "addToCart")
        public void addToCart(AddToCartContext context) {

                String customerId = context.getCustomerId();
                String productId = context.getProductId();
                int quantity = context.getQuantity();

                System.err.print(customerId + "->" + productId + "->" + quantity);

                // 1️⃣ Find or create cart
                Optional<Carts> cartOpt = db.run(
                                Select.from(Carts_.class)
                                                .where(c -> c.customer_ID().eq(customerId)))
                                .first();

                String cartId;

                if (cartOpt.isPresent()) {
                        cartId = cartOpt.get().getId();
                } else {
                        cartId = UUID.randomUUID().toString();

                        Map<String, Object> cartData = new HashMap<>();
                        cartData.put("ID", cartId);
                        cartData.put("customer_ID", customerId);

                        db.run(Insert.into(Carts_.class).entry(cartData));
                }

                // 2️⃣ Check existing cart item
                Optional<CartItems> itemOpt = db.run(
                                Select.from(CartItems_.class)
                                                .where(i -> i.cart_ID().eq(cartId)
                                                                .and(i.product_ID().eq(productId))))
                                .first();

                if (itemOpt.isPresent()) {
                        int newQty = itemOpt.get().getQuantity() + quantity;

                        db.run(
                                        Update.entity(CartItems_.class)
                                                        .data("quantity", newQty)
                                                        .where(i -> i.ID().eq(itemOpt.get().getId())));
                } else {
                        Map<String, Object> item = new HashMap<>();
                        item.put("ID", UUID.randomUUID().toString());
                        item.put("cart_ID", cartId);
                        item.put("product_ID", productId);
                        item.put("quantity", quantity);

                        db.run(Insert.into(CartItems_.class).entry(item));
                }

                // 3️⃣ Create & set response
                AddToCartResponse result = AddToCartResponse.create();
                result.setSuccess(true);
                result.setMessage("Added to cart");
                result.setCartId(cartId);

                context.setResult(result);

        }

        @On(event = "placeOrder")
        public void placeOrder(PlaceOrderContext context) {

                String customerId = context.getCustomerId();
                ActionResponse response = ActionResponse.create();

                // db.tx(tx -> {

                // 1️⃣ Load cart
                Optional<Carts> cartOpt = db.run(
                                Select.from(Carts_.class)
                                                .where(c -> c.customer_ID().eq(customerId)))
                                .first();

                if (cartOpt.isEmpty()) {
                        response.setSuccess(false);
                        response.setMessage("No cart found");
                        context.setResult(response);
                        return;
                }

                String cartId = cartOpt.get().getId();

                // 2️⃣ Load cart items
                List<CartItems> cartItems = db.run(
                                Select.from(CartItems_.class)
                                                .where(ci -> ci.cart_ID().eq(cartId)))
                                .listOf(CartItems.class);

                if (cartItems.isEmpty()) {
                        response.setSuccess(false);
                        response.setMessage("Cart is empty");
                        context.setResult(response);
                        return;
                }

                // 3️⃣ Load all products
                Set<String> productIds = cartItems.stream()
                                .map(ci -> (String) ci.get("product_ID"))
                                .collect(Collectors.toSet());

                Map<String, Products> products = db.run(
                                Select.from(Products_.class)
                                                .where(p -> p.ID().in(productIds)))
                                .listOf(Products.class)
                                .stream()
                                .collect(Collectors.toMap(Products::getId, p -> p));

                BigDecimal total = BigDecimal.ZERO;

                // 4️⃣ Validate stock & calculate total
                for (CartItems ci : cartItems) {
                        Products p = products.get(ci.get("product_ID"));

                        if (p == null)
                                throw new RuntimeException("Product not found");

                        Stocks stock = db.run(
                                        Select.from(Stocks_.class)
                                                        .where(s -> s.product_ID().eq(p.getId())))
                                        .first().orElseThrow(() -> new RuntimeException(
                                                        "Stock not found for product: " + p.getName()));

                        if (stock.getQuantity() < ci.getQuantity()) {
                                throw new RuntimeException("Out of stock: " + p.getName());
                        }

                        total = total.add(
                                        p.getPrice().multiply(BigDecimal.valueOf(ci.getQuantity())));
                }

                // 5️⃣ Create Order
                String orderId = UUID.randomUUID().toString();

                Map<String, Object> order = new HashMap<>();
                order.put("ID", orderId);
                order.put("orderNumber", "ORD-" + System.currentTimeMillis());
                order.put("customer_ID", customerId);
                order.put("orderDate", new Date());
                order.put("status", "CONFIRMED");
                order.put("totalAmount", total);
                order.put("currency_code", "INR");

                // BILLING AND SHIPPING ADDRESS SETTING
                String shippingId = db.run(
                        Select.from(Addresses_.class)
                        .columns(Addresses_.ID)
                        .where(a -> a.customer_ID().eq(customerId)
                                .and(a.type().eq("SHIPPING")))
                ).first(Addresses.class)
                .map(Addresses::getId)
                .orElse(null);

                String billingId = db.run(
                        Select.from(Addresses_.class)
                        .columns(Addresses_.ID)
                        .where(a -> a.customer_ID().eq(customerId)
                                .and(a.type().eq("BILLING")))
                ).first(Addresses.class)
                .map(Addresses::getId)
                .orElse(null);

                order.put("shippingAddress_ID", shippingId);
                order.put("billingAddress_ID", billingId);


                db.run(Insert.into(Orders_.class).entry(order));

                // 6️⃣ Create order items + reduce stock
                for (CartItems ci : cartItems) {

                        Products p = products.get(ci.get("product_ID"));
                        BigDecimal line = p.getPrice().multiply(BigDecimal.valueOf(ci.getQuantity()));

                        Map<String, Object> oi = new HashMap<>();
                        oi.put("ID", UUID.randomUUID().toString());
                        oi.put("order_ID", orderId);
                        oi.put("product_ID", p.getId());
                        oi.put("quantity", ci.getQuantity());
                        oi.put("unitPrice", p.getPrice());
                        oi.put("totalPrice", line);

                        db.run(Insert.into("com.practice.ecommerce.OrderItems").entry(oi));

                        Stocks stock = db.run(
                                        Select.from(Stocks_.class)
                                                        .where(s -> s.product_ID().eq(p.getId())))
                                        .first().orElseThrow(() -> new RuntimeException(
                                                        "Stock not found for product: " + p.getName()));

                        // Reduce stock
                        db.run(Update.entity("com.practice.ecommerce.Stocks")
                                        .data("quantity", stock.getQuantity() - ci.getQuantity())
                                        .where(s -> s.get("product_ID").eq(p.getId())));
                }

                // 7️⃣ Clear cart
                db.run(Delete.from(CartItems_.class)
                                .where(ci -> ci.cart_ID().eq(cartId)));

                response.setSuccess(true);
                response.setMessage("Order placed successfully");
                context.setResult(response);
                // });
        }

        @On(event = "canCustomerReview")
        public void canCustomerReview(CanCustomerReviewContext context) {

                String customerId = context.getCustomerId();
                String productId = context.getProductId();

                CdsResult result = db.run(
                                Select.from(OrderItems_.class)
                                                .columns(oi -> oi.ID()) // minimal column
                                                .where(oi -> oi.product_ID().eq(productId)
                                                                .and(oi.order().customer_ID().eq(customerId)))
                                                .limit(1) // EXISTS semantics
                );

                boolean allowed = result.rowCount() > 0;

                context.setResult(allowed);
        }

  

}
