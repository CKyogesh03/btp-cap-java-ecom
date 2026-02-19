sap.ui.define([
    "sap/ui/core/mvc/Controller",
    "sap/ui/model/json/JSONModel",
    "sap/m/MessageToast",
    "sap/m/MessageBox"
], function (Controller, JSONModel, MessageToast, MessageBox) {
    "use strict";

    return Controller.extend("ecom.controller.Cart", {

        onInit: function () {
            const oRouter = this.getOwnerComponent().getRouter();
            oRouter.getRoute("cart").attachPatternMatched(this._onRouteMatched, this);
            this.getView().setModel(new JSONModel({ items: [] }), "cart");
        },

        _onRouteMatched: function () {
            this._fetchCart();
        },

        _fetchCart: async function () {
            const oView = this.getView();
            const oCustomer = JSON.parse(localStorage.getItem("gokart_selectedCustomer"));
            if (!oCustomer?.id) {
                this.getOwnerComponent().getRouter().navTo("Routeecommerce");
                return;
            }

            oView.setBusy(true);
            const oModel = this.getOwnerComponent().getModel();
            
            try {
                const oFunctionContext = oModel.bindContext("/getCustomerCart(...)");
                oFunctionContext.setParameter("customerId", oCustomer.id);
                await oFunctionContext.execute();
                const oCartData = oFunctionContext.getBoundContext().getObject();
                console.log("cart printing from controller",oCartData);
                oView.getModel("cart").setData(oCartData || { items: [], totalAmount: 0, deliveryCost: 0 });
            } catch (oError) {
                MessageToast.show("Error loading cart");
            } finally {
                oView.setBusy(false);
            }
        },

        onQuantityChange: async function (oEvent) {
            const iNewQuantity = oEvent.getParameter("value");
            const oItemContext = oEvent.getSource().getBindingContext("cart");
            const sCartItemId = oItemContext.getProperty("ID");
            
            this.getView().setBusy(true);
            const oModel = this.getOwnerComponent().getModel();

            try {
                const oActionContext = oModel.bindContext("/updateCartItemQuantity(...)");
                oActionContext.setParameter("cartItemId", sCartItemId);
                oActionContext.setParameter("quantity", iNewQuantity);
                await oActionContext.execute();
                await this._fetchCart(); 
            } catch (oError) {
                MessageToast.show("Failed to update quantity");
            } finally {
                this.getView().setBusy(false);
            }
        },

        onRemoveItem: function (oEvent) {
            const sCartItemId = oEvent.getSource().getBindingContext("cart").getProperty("ID");
            MessageBox.confirm("Remove this item?", {
                onClose: async (oAction) => {
                    if (oAction === MessageBox.Action.OK) {
                        this.getView().setBusy(true);
                        try {
                            const oActionContext = this.getOwnerComponent().getModel().bindContext("/removeCartItem(...)");
                            oActionContext.setParameter("cartItemId", sCartItemId);
                            await oActionContext.execute();
                            await this._fetchCart();
                        } catch (oError) {
                            MessageToast.show("Error removing item");
                        } finally {
                            this.getView().setBusy(false);
                        }
                    }
                }
            });
        },

        onPlaceOrder: async function () {
            const oCustomerStr = localStorage.getItem("gokart_selectedCustomer");
            const oCustomer = oCustomerStr ? JSON.parse(oCustomerStr)  : null;
            if(! oCustomer | ! oCustomer.id ){
                MessageToast.show("Please login to place order")
                return;
            }

            const oModel = this.getOwnerComponent().getModel();
            const oView = this.getView();

            oView.setBusy(true);
            // MessageBox.success("Order Placed!");
            try {

                // 🔥 OData V4 CAP Action Call
                const oActionContext = oModel.bindContext("/placeOrder(...)");

                oActionContext.setParameter("customerId", oCustomer.id);

                console.log("Sending to CAP:", oCustomer.id);

                await oActionContext.execute();

                const oResult = oActionContext.getBoundContext().getObject();
                console.log("CAP response:", oResult);

                if (!oResult || oResult.success !== true) {
                    throw new Error(oResult?.message || "Failed to place order");
                }

                oView.setBusy(false);

                MessageBox.show(oResult.message);
                // if (bIsBuyNow) {
                //     this.getOwnerComponent().getRouter().navTo("cartPage", {
                //         cartId: oResult.cartId
                //     });
                // } else {
                //     MessageToast.show("Product added to cart!");
                // }

            } catch (oError) {
                oView.setBusy(false);

                const sMessage =
                    oError?.message ||
                    oError?.error?.message ||
                    "Error placing order";

                MessageToast.show(sMessage);
            }
        },

        onNavBack: function () {
            this.getOwnerComponent().getRouter().navTo("Routeecommerce");
        }
    });
});