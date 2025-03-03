sap.ui.define([
	"sap/ui/test/Opa5",
	"sap/ui/demo/orderbrowser/test/integration/arrangements/Startup",
	"sap/ui/demo/orderbrowser/test/integration/NavigationJourney"
], function (Opa5, Startup) {
	"use strict";

	Opa5.extendConfig({
		arrangements: new Startup(),
		viewNamespace: "sap.ui.demo.orderbrowser.view.",
		autoWait: true
	});
});