sap.ui.define([
    "sap/ui/core/mvc/Controller",
    'sap/ui/model/json/JSONModel',
    'sap/m/MessageToast',
    'sap/ui/model/Filter',
    'sap/ui/model/FilterOperator'
], (Controller, JSONModel, MessageToast, Filter, FilterOperator) => {
    "use strict";

    return Controller.extend("ecom.controller.ProductSearchResult", {
        
        onInit() {
            const oViewModel = new JSONModel({
                SearchText: "",
                ResultCount: 0,
                IsLoading: false
            });
            this.getView().setModel(oViewModel, "view");

            const oRouter = this.getOwnerComponent().getRouter();
            oRouter.getRoute("productSearchResult").attachPatternMatched(this.onRouteMatched, this);
        },

        onRouteMatched(oEvent) {
            const oArgs = oEvent.getParameter("arguments");
            const sSearchText = oArgs.searchText ? decodeURIComponent(oArgs.searchText) : "";
            
            const oViewModel = this.getView().getModel("view");
            oViewModel.setProperty("/SearchText", sSearchText);
            
            this._fetchFilteredProducts(sSearchText);
        },

        _fetchFilteredProducts(sSearchText) {
            const oList = this.byId("productsList");
            const oViewModel = this.getView().getModel("view");

            if (!sSearchText) {
                oViewModel.setProperty("/ResultCount", 0);
                return;
            }

            oViewModel.setProperty("/IsLoading", true);

            const aFilters = [
                new Filter("name", FilterOperator.Contains, sSearchText),
                new Filter("description", FilterOperator.Contains, sSearchText),
                // new Filter("category", FilterOperator.Contains, sSearchText),
                // new Filter("subCategory", FilterOperator.Contains, sSearchText)
            ];

            const oFilter = new Filter({
                filters: aFilters,
                and: false
            });

            // Get the binding from the XML-defined list
            const oBinding = oList.getBinding("items");

            if (oBinding) {
                // Use attachEventOnce to avoid duplicate listeners on every search
                oBinding.attachEventOnce("dataReceived", () => {
                    oViewModel.setProperty("/ResultCount", oBinding.getLength());
                    oViewModel.setProperty("/IsLoading", false);
                });

                // Applying the filter triggers the refresh automatically
                oBinding.filter(oFilter);
            }
        },

        /**
         * FIXED NAVIGATION LOGIC
         */
    onProductSelected(oEvent) {
    const oItem = oEvent.getSource();
    const oContext = oItem.getBindingContext();

    if (!oContext) {
        MessageToast.show("Loading product...");
        return;
    }

    const oProduct = oContext.getObject();   // <-- THIS forces data resolution

    if (!oProduct || !oProduct.ID) {
        MessageToast.show("Product data not ready");
        return;
    }

    const sProductId = oProduct.ID;

    console.log("Navigating to Product ID:", sProductId);

    this.getOwnerComponent().getRouter().navTo("productDetailPage", {
        id: sProductId
    });
}

,

        onNavBack() {
            this.getOwnerComponent().getRouter().navTo("Routeecommerce");
        },

        onFavoritePress(oEvent) {
            oEvent.stopPropagation(); // Prevents triggering onProductSelected
            MessageToast.show("Added to favorites");
        }
    });
});