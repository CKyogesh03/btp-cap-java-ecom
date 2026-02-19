sap.ui.define([
    "sap/ui/core/mvc/Controller",
    "sap/ui/core/routing/History"
], function (Controller, History) {
    "use strict";

    return Controller.extend("ecom.controller.OrderDetailPage", {

        onInit: function () {
            const oRouter = this.getOwnerComponent().getRouter();
            oRouter.getRoute("orderDetailPage")
                .attachPatternMatched(this._onRouteMatched, this);
        },

        _onRouteMatched: function (oEvent) {
            const sOrderId = oEvent.getParameter("arguments").id;
            const oView = this.getView();

            const sPath = `/Orders(${sOrderId})`;

            console.log("Binding order:", sPath);

            oView.bindElement({
                path: sPath,
                parameters: {
                    $expand: "shippingAddress,billingAddress,items($expand=product)"
                },
                events: {
                    dataReceived: () => {
                        console.log("Order loaded", oView.getBindingContext().getObject());
                    }
                }
            });
        },

        onNavBack: function () {
            const oHistory = History.getInstance();
            if (oHistory.getPreviousHash()) {
                window.history.go(-1);
            } else {
                this.getOwnerComponent().getRouter().navTo("myOrders", {}, true);
            }
        }
    });
});
