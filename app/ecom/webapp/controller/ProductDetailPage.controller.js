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
            oRouter.getRoute("productDetailPage")
                .attachPatternMatched(this._onRouteMatched, this);

            this.getView().setModel(new JSONModel({
                quantity: 1,
                busy: false
            }), "ui");
        },

        // 🔥 THIS IS THE MISSING PIECE
        _onRouteMatched: function (oEvent) {
            const sProductId = oEvent.getParameter("arguments").id;
            const oView = this.getView();
            const oModel = this.getOwnerComponent().getModel();

            oView.getModel("ui").setProperty("/quantity", 1);

            const sPath = `/Products(${sProductId})`;
            console.log("Binding product:", sPath);

            oView.bindElement({
                path: sPath,
                model: undefined, // default OData V4 model
                events: {
                    dataReceived: () => {
                        const oProduct = oView.getBindingContext().getObject();
                        console.log("Product loaded:", oProduct);
                    }
                }
            });

            // 🔥 LOAD REVIEWS USING ODATA FILTER
            this._loadReviews(sProductId);
        },

        onAddToCart: async function () {
            await this._processCartAction(false);
        },

        onBuyNow: async function () {
            await this._processCartAction(true);
        },

        // =============================
        // ADD TO CART / BUY NOW
        // =============================
        _processCartAction: async function (bIsBuyNow) {

            const oCustomerStr = localStorage.getItem("gokart_selectedCustomer");
            const oCustomer = oCustomerStr ? JSON.parse(oCustomerStr) : null;

            if (!oCustomer || !oCustomer.id) {
                MessageToast.show("Please login to continue");
                return;
            }

            const oView = this.getView();
            const oModel = this.getOwnerComponent().getModel();

            // ✅ Product context now always exists
            const oContext = oView.getBindingContext();

            if (!oContext) {
                MessageToast.show("Product not loaded");
                return;
            }

            const oProduct = oContext.getObject();

            if (!oProduct || !oProduct.ID) {
                MessageToast.show("Invalid product data");
                return;
            }

            const iQuantity = oView.getModel("ui").getProperty("/quantity");

            if (!iQuantity || iQuantity <= 0) {
                MessageToast.show("Please select valid quantity");
                return;
            }

            oView.setBusy(true);

            try {
                // 🔥 OData V4 CAP Action Call
                const oActionContext = oModel.bindContext("/addToCart(...)");

                oActionContext.setParameter("customerId", oCustomer.id);
                oActionContext.setParameter("productId", oProduct.ID);
                oActionContext.setParameter("quantity", iQuantity);

                console.log("Sending to CAP:", oCustomer.id, oProduct.ID, iQuantity);

                await oActionContext.execute();

                const oResult = oActionContext.getBoundContext().getObject();
                console.log("CAP response:", oResult);

                if (!oResult || oResult.success !== true) {
                    throw new Error(oResult?.message || "Failed to add to cart");
                }

                oView.setBusy(false);

                if (bIsBuyNow) {
                    this.getOwnerComponent().getRouter().navTo("cartPage", {
                        cartId: oResult.cartId
                    });
                } else {
                    MessageToast.show("Product added to cart!");
                }

            } catch (oError) {
                oView.setBusy(false);

                const sMessage =
                    oError?.message ||
                    oError?.error?.message ||
                    "Error adding to cart";

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
        },
        _loadReviews: async function (sProductId) {

    const oModel = this.getOwnerComponent().getModel();
    const oView = this.getView();

    try {

        const oBinding = oModel.bindList(
            `/Reviews`,
            null,
            null,
            [
                new sap.ui.model.Filter("product_ID", "EQ", sProductId),
                new sap.ui.model.Filter("approved", "EQ", true)
            ],
            {
                $expand: "customer",
                $orderby: "createdAt desc"
            }
        );

        const aContexts = await oBinding.requestContexts();

        const aReviews = aContexts.map(ctx => ctx.getObject());

        console.log("Reviews loaded:", aReviews);

        const oReviewModel = new JSONModel({
            reviews: aReviews
        });

        oView.setModel(oReviewModel, "reviews");

    } catch (e) {
        console.error("Error loading reviews", e);
    }
}

    });
});