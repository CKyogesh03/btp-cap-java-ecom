package customer.btp_cap_java_ecom.handlers;

import java.math.BigDecimal;
import java.util.*;

import org.springframework.stereotype.Component;

import com.sap.cds.CdsResult;
import com.sap.cds.ql.Select;
import com.sap.cds.services.handler.EventHandler;
import com.sap.cds.services.handler.annotations.On;
import com.sap.cds.services.handler.annotations.ServiceName;
import com.sap.cds.services.persistence.PersistenceService;

import cds.gen.com.practice.ecommerce.CartItems;
import cds.gen.com.practice.ecommerce.CartItems_;
import cds.gen.com.practice.ecommerce.Carts;
import cds.gen.com.practice.ecommerce.Carts_;
import cds.gen.ecommerceservice.GetCustomerCartContext;
import cds.gen.ecommerceservice.GetCustomerCartContext.ReturnType;

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

        // 1️⃣ Find cart
        CdsResult<Carts> cartResult = db.run(
            Select.from(Carts_.class)
                  .where(c -> c.customer_ID().eq(customerId))
        );

        Optional<Carts> cartOpt = cartResult.first();
        if (cartOpt.isEmpty()) {
            context.setResult(emptyCart());
            return;
        }

        String cartId = cartOpt.get().get("ID").toString();

        // 2️⃣ Load cart items
        CdsResult<CartItems> itemResult = db.run(
            Select.from(CartItems_.class)
                  .where(i -> i.cart_ID().eq(cartId))
        );

        List<CartItems> cartItems = itemResult.listOf(CartItems.class);

        BigDecimal total = BigDecimal.ZERO;
        List<GetCustomerCartContext.ReturnType.Items> items = new ArrayList<>();

        for (CartItems ci : cartItems) {

            BigDecimal price = ci.getProduct().getPrice();
            int qty = ci.getQuantity();
            BigDecimal lineTotal = price.multiply(BigDecimal.valueOf(qty));
            total = total.add(lineTotal);

            // 3️⃣ Map to Function DTO
            var item = GetCustomerCartContext.ReturnType.Items.create();
            item.setId(ci.getId());
            item.setProductName(ci.getProduct().getName());
            item.setImageUrl(ci.getProduct().getImageUrl());
            item.setUnitPrice(price);
            item.setQuantity(qty);
            item.setTotalPrice(lineTotal);

            items.add(item);
        }

        BigDecimal delivery = total.compareTo(new BigDecimal("500")) >= 0
                ? BigDecimal.ZERO
                : new BigDecimal("50");

        // 4️⃣ Build result
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
}
