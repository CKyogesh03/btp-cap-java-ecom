namespace com.practice.ecommerce;

using { cuid, managed, Currency } from '@sap/cds/common';

/* ---------- CUSTOMERS ---------- */

entity Customers : cuid, managed {
    name   : String(100);
    email  : String(100);
    mobile : String(20);
    
    addresses : Composition of many Addresses
                on addresses.customer = $self;
    orders    : Composition of many Orders
                on orders.customer = $self;
}

/* ---------- ADDRESSES ---------- */

entity Addresses : cuid, managed {
    customer  : Association to Customers;
    type      : String(20); // BILLING, SHIPPING, HOME, OFFICE
    street    : String(100);
    city      : String(50);
    state     : String(50);
    zipCode   : String(20);
    country   : String(50);
    isDefault : Boolean default false;
}

/* ---------- CATEGORIES ---------- */

entity Categories : cuid, managed {
    name          : String(100);
    code          : String(50);
    parent        : Association to Categories;
    subCategories : Composition of many Categories
                    on subCategories.parent = $self;
}

/* ---------- PRODUCTS ---------- */

entity Products : cuid, managed {
    code        : String(50);
    name        : String;
    imageUrl    : String;
    summary     : String;
    description : String;
    category    : Association to Categories;
    currency    : Currency;
    price       : Decimal(13,2);
    status      : String(20); // APPROVED, NOT_APPROVED, REJECTED

    stock       : Composition of one Stocks
                  on stock.product = $self;
    reviews     : Composition of many Reviews
                  on reviews.product = $self;
}

/* ---------- STOCK ---------- */

entity Stocks : cuid, managed {
    product    : Association to Products not null;
    quantity   : Integer;
    warehouse  : String(100);
}

/* ---------- CART ---------- */

entity Carts : cuid, managed {
    customer : Association to Customers not null;
    items    : Composition of many CartItems
               on items.cart = $self;
}

/* ---------- CART ITEMS ---------- */

entity CartItems : cuid, managed {
    cart     : Association to Carts not null;
    product  : Association to Products not null;
    quantity : Integer;
}

/* ---------- ORDERS ---------- */

entity Orders : cuid, managed {
    orderNumber    : String(50);
    customer       : Association to Customers not null;
    orderDate      : DateTime;
    shippingAddress: Association to Addresses;
    billingAddress : Association to Addresses;
    status         : String(20); // PENDING, CONFIRMED, SHIPPED, DELIVERED, CANCELLED
    totalAmount    : Decimal(13,2);
    currency       : Currency;
    
    items          : Composition of many OrderItems
                     on items.order = $self;
    payment        : Composition of one Payment
                     on payment.order = $self;
}

/* ---------- ORDER ITEMS ---------- */

entity OrderItems : cuid, managed {
    order       : Association to Orders not null;
    product     : Association to Products not null;
    quantity    : Integer;
    unitPrice   : Decimal(13,2);
    totalPrice  : Decimal(13,2);
}

/* ---------- PAYMENT ---------- */

entity Payment : cuid, managed {
    order       : Association to Orders;
    amount      : Decimal(13,2);
    currency    : Currency;
    method      : String(50); // CARD, NET_BANKING, WALLET, COD
    status      : String(20); // PENDING, SUCCESS, FAILED, REFUNDED
    transactionId: String(100);
    paymentDate : DateTime;
}

/* ---------- REVIEWS ---------- */

entity Reviews : cuid, managed {
    product   : Association to Products;
    customer  : Association to Customers;
    rating    : Integer;   // 1–5
    title     : String(100);
    comment   : String(500);
    approved  : Boolean default false;
}

annotate Reviews with @unique: {
    customer, product
};