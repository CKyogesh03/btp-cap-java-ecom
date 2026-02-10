sap.ui.define([
    "sap/ui/core/mvc/Controller",
    'sap/ui/model/json/JSONModel',
    'sap/m/MessageToast',
    'sap/ui/Device'
], (Controller, JSONModel, MessageToast, Device) => {
    "use strict";


    return Controller.extend("ecom.controller.ecommerce", {
      onInit() {
            // 1. Initialize view model for UI state
            const oViewModel = new JSONModel({
                SelectedCustomer: null,
                SearchValue: ""
            });
            this.getView().setModel(oViewModel, "view");
            // 2. OData model (Default model from manifest)
            // No need to manually set it here as it's usually inherited from Component.js
            
            // 3. Carousel Banners (Optional)
            // If you use the static URLs I provided in the XML, you don't need this.
            // If you want to use a local JSON file for banners, keep this:
            // var oImgModel = new JSONModel(sap.ui.require.toUrl("gokart/model/img.json"));
            // this.getView().setModel(oImgModel, "img");

            // 4. Restore user selection
            this._restoreSelectedCustomer();
        },

        /**
         * Triggered by 'liveChange' in XML (if added)
         */
        onSearchValueChange(oEvent) {
            console.log("change event in search ",oEvent)
            const sSearchValue = oEvent.getParameter("newValue");
            this.getView().getModel("view").setProperty("/SearchValue", sSearchValue);
        },

        /**
         * Triggered by 'search' event in XML SearchField
         */
        onSearchButtonPressed(oEvent) {
            console.log("search button press event -> this keyword",this)
            console.log("search button press event -> oEvent argument",oEvent)
            // Get value either from event or from the model
            const sSearchValue = oEvent.getParameter("query") || this.byId("searchField").getValue();
            
            if (!sSearchValue) {
                MessageToast.show("Please enter a search term");
                return;
            }

            const oRouter = this.getOwnerComponent().getRouter();
            oRouter.navTo("productSearchResult", {
                searchText: encodeURIComponent(sSearchValue)
            });
        },

        /**
         * Triggered by 'change' event in XML Select
         */
        onCustomerSelected(oEvent) {
            console.log("select customer oEvent ",oEvent)
            console.log("select customer oEvent ",oEvent.constructor.name)
            const oSelectedItem = oEvent.getParameter("selectedItem");
            if (!oSelectedItem) return;

            const oSelectedCustomer = oSelectedItem.getBindingContext().getObject();
            const sCustomername = oSelectedCustomer.name;
            
            // Update view model
            this.getView().getModel("view").setProperty("/SelectedCustomer", sCustomername);
            
            // Save to localStorage
            this._saveSelectedCustomer(oSelectedCustomer);
            
            MessageToast.show(`Welcome, ${sCustomername}`);
        },

        _saveSelectedCustomer(oCustomer) {
            try {
                const oCustomerData = {
                    username: oCustomer.name,
                    id: oCustomer.ID,
                    timestamp: new Date().toISOString()
                };
                localStorage.setItem("gokart_selectedCustomer", JSON.stringify(oCustomerData));
            } catch (error) {
                console.error("Error saving Customer", error);
            }
        },

        _restoreSelectedCustomer() {
            try {
                const sCustomerData = localStorage.getItem("gokart_selectedCustomer");
                if (sCustomerData) {
                    const oCustomer = JSON.parse(sCustomerData);
                    this.getView().getModel("view").setProperty("/SelectedCustomer", oCustomer.name);
                    
                    // Note: If the Select items are loading from OData, 
                    // the visual selection happens automatically via the {view>/SelectedCustomer} binding.
                }
            } catch (error) {
                console.error("Error restoring Customer", error);
            }
        },
        onCartPressed() {
            const oRouter = this.getOwnerComponent().getRouter();
            // Navigate to the 'cart' route
            // Note: Ensure "cart" is defined in your manifest.json under routing -> routes
            oRouter.navTo("cart");
        },
    });
});