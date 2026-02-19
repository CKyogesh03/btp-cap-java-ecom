sap.ui.define([
    "sap/ui/core/mvc/Controller",
    "sap/ui/model/Filter",
    "sap/ui/model/FilterOperator",
    "sap/m/MessageToast"
], function (Controller, Filter, FilterOperator, MessageToast) {
    "use strict";

    return Controller.extend("ecom.controller.MyOrders", {

        onInit: function () {
            const oRouter = this.getOwnerComponent().getRouter();
            oRouter.getRoute("myOrders").attachPatternMatched(this._onRouteMatched, this);
        },

        _onRouteMatched: function () {
            this._loadOrders();
        },

        _loadOrders: function () {
            const oCustomer = JSON.parse(localStorage.getItem("gokart_selectedCustomer"));

            if (!oCustomer || !oCustomer.id) {
                MessageToast.show("Please login");
                this.getOwnerComponent().getRouter().navTo("Routeecommerce");
                return;
            }

            const oList = this.byId("ordersList");
            const oFilter = new Filter("customer/ID", FilterOperator.EQ, oCustomer.id);

            oList.bindItems({
                path: "/Orders",
                filters: [oFilter],
                parameters: {
                    $expand: "items"
                },
                template: this.byId("orderItemTemplate")
            });
        },

        onOrderPress: function (oEvent) {
            const sOrderId = oEvent.getSource()
                .getBindingContext()
                .getProperty("ID");

            this.getOwnerComponent().getRouter().navTo("orderDetailPage", {
                id: sOrderId
            });
        },

        onNavBack: function () {
            this.getOwnerComponent().getRouter().navTo("Routeecommerce");
        }

    });
});
