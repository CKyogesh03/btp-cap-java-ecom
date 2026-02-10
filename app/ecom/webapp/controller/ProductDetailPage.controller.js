sap.ui.define([
    "sap/ui/core/mvc/Controller",
    "sap/ui/model/json/JSONModel",
    "sap/m/MessageToast",
    "sap/ui/core/routing/History"
], function (Controller, JSONModel, MessageToast, History) {
    "use strict";

    return Controller.extend("ecom.controller.ProductDetailPage", {

        formatter: {
            isStockAvailable: function (iStocks) {
                return !!(iStocks && iStocks > 0);
            },
            stockState: function (iStocks) {
                return iStocks > 0 ? "Success" : "Error";
            },
            stockText: function (iStocks) {
                return iStocks > 0 ? "In Stock (" + iStocks + ")" : "Out of Stock";
            }
        },

        onInit: function () {
            const oRouter = this.getOwnerComponent().getRouter();
            oRouter.getRoute("productDetailPage").attachPatternMatched(this._onRouteMatched, this);

            this.getView().setModel(new JSONModel({
                quantity: 1,
                busy: false
            }), "ui");
        },

        _onRouteMatched: function (oEvent) {
            const sProductId = oEvent.getParameter("arguments").id;
            const oView = this.getView();
            
            oView.getModel("ui").setProperty("/quantity", 1);
            
            // OData V4 Binding
            oView.bindElement({
                path: `/Products(${sProductId})`
            });
        },

        // Using async/await for cleaner flow
        onAddToCart: async function () {
            await this._processCartAction(false);
        },

        onBuyNow: async function () {
            await this._processCartAction(true);
        },

        _processCartAction: async function (bIsBuyNow) {
            const oCustomerStr = localStorage.getItem("gokart_selectedCustomer");
            const oCustomer = oCustomerStr ? JSON.parse(oCustomerStr) : null;

            if (!oCustomer || !oCustomer.id) {
                MessageToast.show("Please login to continue");
                return;
            }

            const oView = this.getView();
            const oModel = this.getOwnerComponent().getModel();
            const oContext = oView.getBindingContext();
            
            if (!oContext) return;

            const oProduct = oContext.getObject();
            const iQuantity = oView.getModel("ui").getProperty("/quantity");

            oView.setBusy(true);

            try {
                /**
                 * ODATA V4 WAY TO CALL ACTIONS/FUNCTIONS
                 * We bind to the path of the function and call execute()
                 */
                const oActionContext = oModel.bindContext("/addToCart(...)");
                
                oActionContext.setParameter("productId", oProduct.ID);
                oActionContext.setParameter("customerId", oCustomer.id);
                oActionContext.setParameter("quantity", iQuantity);

                await oActionContext.execute();

                oView.setBusy(false);
                if (bIsBuyNow) {
                    this.getOwnerComponent().getRouter().navTo("cartPage");
                } else {
                    MessageToast.show("Product added to cart!");
                }
            } catch (oError) {
                oView.setBusy(false);
                // Handle V4 error messages
                const sMessage = oError.statusText || "Error adding to cart";
                MessageToast.show(sMessage);
            }
        },

        onNavBack: function () {
            const oHistory = History.getInstance();
            if (oHistory.getPreviousHash() !== undefined) {
                window.history.go(-1);
            } else {
                this.getOwnerComponent().getRouter().navTo("Routeecommerce", {}, true);
            }
        }
    });
});