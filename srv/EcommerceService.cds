using com.practice.ecommerce as db from '../db/schema';

type CartItemResponse {
    ID          : UUID;
    productName : String;
    imageUrl    : String;
    unitPrice   : Decimal(13,2);
    quantity    : Integer;
    totalPrice  : Decimal(13,2);
}

type CartResponse {
    items        : many CartItemResponse;
    totalAmount  : Decimal(13,2);
    deliveryCost : Decimal(13,2);
}

service EcommerceService {

    /* ---------- MASTER DATA ---------- */

    entity Categories as projection on db.Categories;
    entity Products   as projection on db.Products;
    entity Stocks     as projection on db.Stocks;
    entity Customers  as projection on db.Customers;

    /* ---------- TRANSACTION DATA ---------- */

    entity Carts      as projection on db.Carts;
    entity CartItems  as projection on db.CartItems;
    entity Reviews    as projection on db.Reviews;

    
  function getCustomerCart(customerId : String) returns {
    items : array of {
      ID          : String;
      productId   : String;
      productName : String;
      imageUrl    : String;
      unitPrice   : Decimal(13,2);
      quantity    : Integer;
      totalPrice  : Decimal(13,2);
    };
    totalAmount : Decimal(13,2);
    deliveryCost : Decimal(13,2);
  };

  action updateCartItemQuantity(cartItemId : String, quantity : Integer);
  action removeCartItem(cartItemId : String);
    
}
