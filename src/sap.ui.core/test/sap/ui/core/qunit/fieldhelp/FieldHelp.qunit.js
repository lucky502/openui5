/*!
 * ${copyright}
 */
sap.ui.define([
	"sap/base/Log",
	"sap/ui/base/BindingInfo",
	"sap/ui/base/ManagedObject",
	"sap/ui/core/Element",
	"sap/ui/core/ElementRegistry",
	"sap/ui/core/LabelEnablement",
	"sap/ui/core/fieldhelp/FieldHelp",
	"sap/ui/model/CompositeBinding",
	"sap/ui/model/ManagedObjectBindingSupport"
], function (Log, BindingInfo, ManagedObject, Element, ElementRegistry, LabelEnablement, FieldHelp, CompositeBinding,
		ManagedObjectBindingSupport) {
	/*global sinon, QUnit*/
	"use strict";
	const sClassName = "sap/ui/core/fieldhelp/FieldHelp";

	//*********************************************************************************************
	QUnit.module("sap/ui/core/fieldhelp/FieldHelp", {
		beforeEach : function () {
			this.oLogMock = this.mock(Log);
			this.oLogMock.expects("error").never();
			this.oLogMock.expects("warning").never();
		},
		afterEach : function () {
			// ensure to clean up
			FieldHelp.getInstance().deactivate();
			ElementRegistry.forEach((oElement) => {
				oElement.destroy();
			});
		}
	});

	//*********************************************************************************************
	QUnit.test("constructor", function (assert) {
		// code under test
		const oFieldHelp = new FieldHelp();

		assert.strictEqual(oFieldHelp.bActive, undefined, "private member");
		assert.strictEqual(oFieldHelp.isActive(), false);
	});

	//*********************************************************************************************
	QUnit.test("getInstance", function (assert) {
		// code under test
		const oFieldHelp = FieldHelp.getInstance();

		assert.ok(oFieldHelp);
		assert.ok(oFieldHelp instanceof FieldHelp);

		// code under test
		assert.strictEqual(FieldHelp.getInstance(), oFieldHelp);
	});

	//*********************************************************************************************
	QUnit.test("activate", function (assert) {
		const oFieldHelp = FieldHelp.getInstance();
		const oFieldHelpMock = this.mock(oFieldHelp);

		assert.strictEqual(oFieldHelp.isActive(), false);
		assert.strictEqual(ElementRegistry.size, 0);

		// ElementRegistry.forEach cannot be mocked - test it integratively
		const oElement0 = new Element();
		const oElement1 = new Element();
		const oElement2 = new Element();

		assert.strictEqual(ElementRegistry.size, 3);
		const oElement0Mock = this.mock(oElement0);
		const aDocumentationRefs = ["~vValue0", "~vValue1"];
		oElement0Mock.expects("data").withExactArgs("sap-ui-DocumentationRef").returns(aDocumentationRefs);
		oElement0Mock.expects("getMetadata").withExactArgs().returns({
			getName() { return "oElement0"; } // required by oElement.toString called by sinon
		});
		oFieldHelpMock.expects("_updateElement")
			.withExactArgs(sinon.match.same(oElement0),
				sinon.match.same(aDocumentationRefs).and(sinon.match(["~vValue0", "~vValue1"])));

		const oElement1Mock = this.mock(oElement1);
		oElement1Mock.expects("data").withExactArgs("sap-ui-DocumentationRef").returns(null);
		const oElement1MetaData = {
			getAllProperties() {},
			getName() { return "oElement1"; } // required by oElement.toString called by sinon
		};
		oElement1Mock.expects("getMetadata").atLeast(1).withExactArgs().returns(oElement1MetaData);
		this.mock(oElement1MetaData).expects("getAllProperties")
			.withExactArgs()
			.returns({"~sPropertyName1": {}, "~sPropertyName2": {}});
		oFieldHelpMock.expects("_updateProperty").withExactArgs(sinon.match.same(oElement1), "~sPropertyName1");
		oFieldHelpMock.expects("_updateProperty").withExactArgs(sinon.match.same(oElement1), "~sPropertyName2");

		const oElement2Mock = this.mock(oElement2);
		const aDocumentationRefs2 = ["~vValue"];
		oElement2Mock.expects("data").withExactArgs("sap-ui-DocumentationRef").returns(aDocumentationRefs2);
		oElement2Mock.expects("getMetadata").withExactArgs().returns({
			getName() { return "oElement2"; } // required by oElement.toString called by sinon
		});
		oFieldHelpMock.expects("_updateElement")
			.withExactArgs(sinon.match.same(oElement2),
				sinon.match.same(aDocumentationRefs2).and(sinon.match(["~vValue"])));

		const fnUpdateHotspotsCallback = () => {};

		// code under test
		oFieldHelp.activate(fnUpdateHotspotsCallback);

		assert.strictEqual(oFieldHelp.isActive(), true);

		// code under test - second call does nothing as field help is already active
		oFieldHelp.activate(fnUpdateHotspotsCallback);

		assert.throws(() => {
			// code under test - second call of activate with different callback throws error
			oFieldHelp.activate(() => {});
		}, new Error("The field help is active for a different update hotspots callback handler"));
	});

	//*********************************************************************************************
	QUnit.test("activate, deactivate and isActive", function (assert) {
		const oFieldHelp = FieldHelp.getInstance();
		assert.strictEqual(oFieldHelp.isActive(), false);
		assert.strictEqual(ManagedObject.prototype.updateFieldHelp, undefined);

		// code under test - use empty element registry to avoid calculating any field help
		oFieldHelp.activate(() => {/* any callback function */});

		assert.strictEqual(oFieldHelp.isActive(), true);
		const fnUpdateFieldHelp = ManagedObject.prototype.updateFieldHelp;
		assert.ok(typeof fnUpdateFieldHelp === "function");

		const oElement = {};
		this.mock(oFieldHelp).expects("_updateProperty").withExactArgs(sinon.match.same(oElement), "~propertyName");

		// code under test
		fnUpdateFieldHelp.call(oElement, "~propertyName");

		// code under test
		oFieldHelp.deactivate();

		assert.strictEqual(oFieldHelp.isActive(), false);
		assert.strictEqual(ManagedObject.prototype.updateFieldHelp, undefined);

		// code under test - can be called multiple times without throwing an error
		oFieldHelp.deactivate();

		assert.strictEqual(oFieldHelp.isActive(), false);

		// code under test - after deactivation another callback handler can be used
		oFieldHelp.activate(() => {/* another callback function */});

		assert.strictEqual(oFieldHelp.isActive(), true);
		assert.strictEqual(ManagedObject.prototype.updateFieldHelp, fnUpdateFieldHelp, "Implementation is reused");

		// cleanup
		oFieldHelp.deactivate();
	});

	//*********************************************************************************************
	QUnit.test("_updateProperty: nothing to do cases", function (assert) {
		const oFieldHelp = FieldHelp.getInstance();

		this.mock(oFieldHelp).expects("_setFieldHelpDocumentationRefs").never();
		const oElement = {
			getBinding() {},
			getMetadata() {}
		};
		const oElementMock = this.mock(oElement);
		const oMetadata = {getProperty() {}};
		const oMetadataMock = this.mock(oMetadata);
		oElementMock.expects("getMetadata").withExactArgs().returns(oMetadata);
		oElementMock.expects("getBinding").never();
		oMetadataMock.expects("getProperty").withExactArgs("~property").returns({group: "Misc"});
		oFieldHelp.activate("~fnCallback");

		// code under test - property is not in "Data" group
		oFieldHelp._updateProperty(oElement, "~property");

		oElementMock.expects("getMetadata").withExactArgs().returns(oMetadata);
		oElementMock.expects("getBinding").never();
		oMetadataMock.expects("getProperty").withExactArgs("tooltip").returns(undefined);
		oFieldHelp.activate("~fnCallback");

		// code under test - update is called for an association (e.g. "tooltip") which does not have property metadata
		oFieldHelp._updateProperty(oElement, "tooltip");

		oElementMock.expects("getMetadata").withExactArgs().returns(oMetadata);
		oMetadataMock.expects("getProperty").withExactArgs("~property").returns({group: "Data"});
		oElementMock.expects("getBinding").withExactArgs("~property").returns(undefined);

		// code under test - property is in "Data" group but has no binding
		oFieldHelp._updateProperty(oElement, "~property");
	});

	//*********************************************************************************************
	QUnit.test("_updateProperty: PropertyBinding without DocumentationRef", function (assert) {
		const oElement = {
			getBinding() {},
			getMetadata() {}
		};
		const oElementMock = this.mock(oElement);
		const oMetadata = {getProperty() {}};
		const oMetadataMock = this.mock(oMetadata);
		oElementMock.expects("getMetadata").withExactArgs().returns(oMetadata);
		oMetadataMock.expects("getProperty").withExactArgs("~property").returns({group: "Data"});
		const oBinding = {isA() {}};
		const oPromise = Promise.resolve(); // resolves with undefined, means no documentation ref
		this.mock(FieldHelp).expects("_requestDocumentationRef").withExactArgs(sinon.match.same(oBinding))
			.returns(oPromise);
		oElementMock.expects("getBinding").withExactArgs("~property").returns(oBinding);
		this.mock(oBinding).expects("isA").withExactArgs("sap.ui.model.CompositeBinding").returns(false);
		const oFieldHelp = FieldHelp.getInstance();
		oFieldHelp.activate("~fnCallback");
		// call _setFieldHelpDocumentationRefs even if there ar no documentation refs for proper cleanup
		this.mock(oFieldHelp).expects("_setFieldHelpDocumentationRefs")
			.withExactArgs(sinon.match.same(oElement), "~property", []);

		// code under test - property is in "Data" group, has a binding and it is not a CompositeBinding
		oFieldHelp._updateProperty(oElement, "~property");

		return oPromise;
	});

	//*********************************************************************************************
	QUnit.test("_updateProperty: PropertyBinding with DocumenatationRef", function (assert) {
		const oElement = {
			getBinding() {},
			getMetadata() {}
		};
		const oElementMock = this.mock(oElement);
		const oMetadata = {getProperty() {}};
		const oMetadataMock = this.mock(oMetadata);
		oElementMock.expects("getMetadata").withExactArgs().returns(oMetadata);
		oMetadataMock.expects("getProperty").withExactArgs("~property").returns({group: "Data"});
		const oBinding = {isA() {}};
		oElementMock.expects("getBinding").withExactArgs("~property").returns(oBinding);
		this.mock(oBinding).expects("isA").withExactArgs("sap.ui.model.CompositeBinding").returns(false);
		const oPromise = Promise.resolve("~documentationRef");
		this.mock(FieldHelp).expects("_requestDocumentationRef").withExactArgs(sinon.match.same(oBinding))
			.returns(oPromise);
		const oFieldHelp = FieldHelp.getInstance();
		const oFieldHelpMock = this.mock(oFieldHelp);
		oFieldHelp.activate("~fnCallback");
		oFieldHelpMock.expects("_setFieldHelpDocumentationRefs").never();

		// code under test - property is in "Data" group, has a binding and it is not a CompositeBinding
		oFieldHelp._updateProperty(oElement, "~property");

		// is called asynchronously
		oFieldHelpMock.expects("_setFieldHelpDocumentationRefs")
			.withExactArgs(sinon.match.same(oElement), "~property", ["~documentationRef"]);

		return oPromise;
	});

	//*********************************************************************************************
[false, true].forEach((bHasType) => {
	QUnit.test(`_updateProperty: composite binding, has type: ${bHasType}`, function (assert) {
		const oElement = {
			getBinding() {},
			getMetadata() {}
		};
		const oElementMock = this.mock(oElement);
		const oMetadata = {getProperty() {}};
		const oMetadataMock = this.mock(oMetadata);
		oElementMock.expects("getMetadata").withExactArgs().returns(oMetadata);
		oMetadataMock.expects("getProperty").withExactArgs("~property").returns({group: "Data"});
		const oCompositeBinding = {
			getBindings() {},
			getType() {},
			isA() {}
		};
		const oCompositeBindingMock = this.mock(oCompositeBinding);
		oElementMock.expects("getBinding").withExactArgs("~property").returns(oCompositeBinding);
		oCompositeBindingMock.expects("isA").withExactArgs("sap.ui.model.CompositeBinding").returns(true);
		const oCompositeType = {getPartsIgnoringMessages() {}};
		oCompositeBindingMock.expects("getType").withExactArgs().returns(bHasType ? oCompositeType : undefined);
		this.mock(oCompositeType).expects("getPartsIgnoringMessages").withExactArgs()
			.exactly(bHasType ? 1 : 0)
			.returns([3]);
		const oBinding0 = {};
		const oBinding1 = {};
		const oBinding2 = {};
		const oBinding3 = {};
		oCompositeBindingMock.expects("getBindings").withExactArgs()
			.returns([oBinding0, oBinding1, oBinding2, oBinding3]);
		const oDocumentationRefPromise0 = Promise.resolve("~documentationRef0");
		const oFieldHelpModuleMock = this.mock(FieldHelp);
		oFieldHelpModuleMock.expects("_requestDocumentationRef").withExactArgs(sinon.match.same(oBinding0))
			.returns(oDocumentationRefPromise0);
		oFieldHelpModuleMock.expects("_requestDocumentationRef").withExactArgs(sinon.match.same(oBinding1))
			.returns(undefined); // binding does not support documentation refs
		const oDocumentationRefPromise2 = Promise.resolve(); // resolves with undefined, means no documentation ref
		oFieldHelpModuleMock.expects("_requestDocumentationRef").withExactArgs(sinon.match.same(oBinding2))
			.returns(oDocumentationRefPromise2);
		const oDocumentationRefPromise3 = Promise.resolve("~documentationRef3");
		oFieldHelpModuleMock.expects("_requestDocumentationRef").withExactArgs(sinon.match.same(oBinding3))
			.exactly(bHasType ? 0 : 1)
			.returns("~documentationRef3");
		const oFieldHelp = FieldHelp.getInstance();
		const oFieldHelpMock = this.mock(oFieldHelp);
		oFieldHelpMock.expects("_setFieldHelpDocumentationRefs").never();
		oFieldHelp.activate("~fnCallback");

		// code under test - property is in "Data" group, has a CompositeBinding without a type
		oFieldHelp._updateProperty(oElement, "~property");

		oFieldHelpMock.expects("_setFieldHelpDocumentationRefs")
			.withExactArgs(sinon.match.same(oElement), "~property",
				bHasType ? ["~documentationRef0"] : ["~documentationRef0", "~documentationRef3"]);

		return Promise.all([oDocumentationRefPromise0, oDocumentationRefPromise2, oDocumentationRefPromise3]);
	});
});

	//*********************************************************************************************
	QUnit.test("_updateElement: elements that are destroyed or are beeing destroyed", function (assert) {
		const oFieldHelp = new FieldHelp();
		const oFieldHelpMock = this.mock(oFieldHelp);
		const oElement = {
			isDestroyed() {},
			isDestroyStarted() {}
		};
		const oElementMock = this.mock(oElement);
		oElementMock.expects("isDestroyed").withExactArgs().returns(true);
		oElementMock.expects("isDestroyStarted").never();
		oFieldHelpMock.expects("_setFieldHelpDocumentationRefs")
			.withExactArgs(sinon.match.same(oElement), undefined, []);

		// code under test - already destroyed
		oFieldHelp._updateElement(oElement, ["~documentationRef"]);

		oElementMock.expects("isDestroyed").withExactArgs().returns(false);
		oElementMock.expects("isDestroyStarted").withExactArgs().returns(true);
		oFieldHelpMock.expects("_setFieldHelpDocumentationRefs")
			.withExactArgs(sinon.match.same(oElement), undefined, []);

		// code under test - is beeing destroyed
		oFieldHelp._updateElement(oElement, ["~documentationRef"]);
	});

	//*********************************************************************************************
	QUnit.test("_updateElement: active control", function (assert) {
		const oFieldHelp = new FieldHelp();
		const oFieldHelpMock = this.mock(oFieldHelp);
		const oElement = {
			data() {},
			isDestroyed() {},
			isDestroyStarted() {}
		};
		const oElementMock = this.mock(oElement);
		oElementMock.expects("data").never();
		oElementMock.expects("isDestroyed").withExactArgs().returns(false);
		oElementMock.expects("isDestroyStarted").withExactArgs().returns(false);
		const aDocumentationRefs = ["~documentationRef"];
		oFieldHelpMock.expects("_setFieldHelpDocumentationRefs")
			.withExactArgs(sinon.match.same(oElement), undefined,
				sinon.match.same(aDocumentationRefs).and(sinon.match(["~documentationRef"])));

		// code under test - documentation refs already given
		oFieldHelp._updateElement(oElement, aDocumentationRefs);

		oElementMock.expects("isDestroyed").withExactArgs().returns(false);
		oElementMock.expects("isDestroyStarted").withExactArgs().returns(false);
		oElementMock.expects("data").withExactArgs("sap-ui-DocumentationRef").returns(aDocumentationRefs);
		oFieldHelpMock.expects("_setFieldHelpDocumentationRefs")
			.withExactArgs(sinon.match.same(oElement), undefined,
				sinon.match.same(aDocumentationRefs).and(sinon.match(["~documentationRef"])));

		// code under test - documentation refs have to be determined
		oFieldHelp._updateElement(oElement);

		oElementMock.expects("isDestroyed").withExactArgs().returns(false);
		oElementMock.expects("isDestroyStarted").withExactArgs().returns(false);
		oElementMock.expects("data").withExactArgs("sap-ui-DocumentationRef").returns(undefined);
		oFieldHelpMock.expects("_setFieldHelpDocumentationRefs")
			.withExactArgs(sinon.match.same(oElement), undefined, []);

		// code under test - documentation refs have to be determined, but may be deleted in between
		oFieldHelp._updateElement(oElement);
	});

	//*********************************************************************************************
	QUnit.test("_updateHotspots", function (assert) {
		const oFieldHelp = new FieldHelp();
		const fnUpdateHotspotsCallback = this.stub();
		const oFieldHelpMock = this.mock(oFieldHelp);
		oFieldHelp.activate(fnUpdateHotspotsCallback);

		// code under test
		const oPromise = oFieldHelp._updateHotspots();

		assert.ok(oPromise instanceof Promise);

		// code under test - as long as data is collected, the same promise is returned
		assert.strictEqual(oFieldHelp._updateHotspots(), oPromise);

		// called async
		assert.strictEqual(fnUpdateHotspotsCallback.callCount, 0); // not yet called; will be called after a timeout
		oFieldHelpMock.expects("isActive").withExactArgs().returns(true);
		oFieldHelpMock.expects("_getFieldHelpHotspots").withExactArgs().returns(["~aHotspots"]);

		return oPromise.then((oResult) => {
			assert.strictEqual(oResult, undefined); // resolves without any value
			assert.strictEqual(fnUpdateHotspotsCallback.callCount, 1);
			assert.strictEqual(fnUpdateHotspotsCallback.getCall(0).args.length, 1);
			assert.deepEqual(fnUpdateHotspotsCallback.getCall(0).args[0], ["~aHotspots"]);
			fnUpdateHotspotsCallback.resetHistory();

			// code under test
			const oPromise2 = oFieldHelp._updateHotspots();

			assert.notStrictEqual(oPromise2, oPromise);
			oFieldHelpMock.expects("isActive").withExactArgs().returns(false);
			assert.strictEqual(fnUpdateHotspotsCallback.callCount, 0);

			return oPromise2.catch((oReason) => {
				assert.strictEqual(oReason, undefined); // rejects without any value
				assert.strictEqual(fnUpdateHotspotsCallback.callCount, 0); // not called if deactivated
			});
		}).then(() => {
			// code under test
			const oPromise3 = oFieldHelp._updateHotspots();

			oFieldHelpMock.expects("isActive").withExactArgs().returns(true);
			oFieldHelpMock.expects("_getFieldHelpHotspots").withExactArgs().returns([]);
			assert.strictEqual(fnUpdateHotspotsCallback.callCount, 0);

			return oPromise3;
		}).then(() => {
			// update hotspots has to be called even if there are no hotspots
			assert.strictEqual(fnUpdateHotspotsCallback.callCount, 1);
			assert.deepEqual(fnUpdateHotspotsCallback.getCall(0).args[0], []);
		});
	});

	//*********************************************************************************************
	QUnit.test("_getFieldHelpHotspots and _setFieldHelpDocumentationRefs", function (assert) {
		const oFieldHelp = new FieldHelp();
		const oFieldHelpMock = this.mock(oFieldHelp);
		oFieldHelpMock.expects("_getFieldHelpDisplayMapping").withExactArgs().atLeast(1).returns({});

		// code under test - there are no registered controls
		assert.deepEqual(oFieldHelp._getFieldHelpHotspots(), []);

		const oElement0 = {getId() {}};
		const oElement0Mock = this.mock(oElement0);
		oElement0Mock.expects("getId").withExactArgs().returns("~element0");
		const oUpdateHotspotsPromise = {catch() {}};
		const oUpdateHotspotsPromiseMock = this.mock(oUpdateHotspotsPromise);
		oFieldHelpMock.expects("_updateHotspots").withExactArgs().returns(oUpdateHotspotsPromise);
		// ensure that Promise is caught to avoid uncaught in Promise
		oUpdateHotspotsPromiseMock.expects("catch").withExactArgs(sinon.match.func).callThrough();

		// code under test - set a single field help URN for the control
		oFieldHelp._setFieldHelpDocumentationRefs(oElement0, undefined, [
			"urn:sap-com:documentation:key?=type=~customType0&id=~customId0"
		]);

		const oElement1 = {getId() {}};
		const oElement1Mock = this.mock(oElement1);
		oElement1Mock.expects("getId").withExactArgs().returns("~element1");
		oFieldHelpMock.expects("_updateHotspots").withExactArgs().returns(oUpdateHotspotsPromise);
		oUpdateHotspotsPromiseMock.expects("catch").withExactArgs(sinon.match.func).callThrough();

		// code under test - multiple URNs for a control
		oFieldHelp._setFieldHelpDocumentationRefs(oElement1, undefined, [
			"urn:sap-com:documentation:key?=type=~customType1&id=~customId1&origin=~origin1",
			"urn:sap-com:documentation:key?=type=~customType2&id=~customId2&origin=~origin2"
		]);

		oElement1Mock.expects("getId").withExactArgs().returns("~element1");
		oFieldHelpMock.expects("_updateHotspots").withExactArgs().returns(oUpdateHotspotsPromise);
		oUpdateHotspotsPromiseMock.expects("catch").withExactArgs(sinon.match.func).callThrough();

		// code under test - single URN for a control property
		oFieldHelp._setFieldHelpDocumentationRefs(oElement1, "~property0", [
			"urn:sap-com:documentation:key?=type=~customType3&id=~customId3"
		]);

		oElement1Mock.expects("getId").withExactArgs().returns("~element1");
		oFieldHelpMock.expects("_updateHotspots").withExactArgs().returns(oUpdateHotspotsPromise);
		oUpdateHotspotsPromiseMock.expects("catch").withExactArgs(sinon.match.func).callThrough();

		// code under test - duplicate URN for a different control property
		oFieldHelp._setFieldHelpDocumentationRefs(oElement1, "~property1", [
			"urn:sap-com:documentation:key?=type=~customType3&id=~customId3"
		]);

		const oElementMock = this.mock(Element);
		oElementMock.expects("getElementById").withExactArgs("~element0").atLeast(1).returns(oElement0);
		const oLabelEnablementMock = this.mock(LabelEnablement);
		oLabelEnablementMock.expects("_getLabelTexts").withExactArgs(sinon.match.same(oElement0))
			.returns(["~sLabel0", "foo"]);
		oElementMock.expects("getElementById").withExactArgs("~element1").atLeast(1).returns(oElement1);
		oLabelEnablementMock.expects("_getLabelTexts").withExactArgs(sinon.match.same(oElement1)).returns(["~sLabel1"]);

		// code under test
		assert.deepEqual(oFieldHelp._getFieldHelpHotspots(), [{
			backendHelpKey: {id: "~customId0", type: "~customType0"},
			hotspotId: "~element0",
			labelText: "~sLabel0"
		}, {
			backendHelpKey: {id: "~customId1", origin: "~origin1", type: "~customType1"},
			hotspotId: "~element1",
			labelText: "~sLabel1"
		}, {
			backendHelpKey: {id: "~customId2", origin: "~origin2", type: "~customType2"},
			hotspotId: "~element1",
			labelText: "~sLabel1"
		}, {
			backendHelpKey: {id: "~customId3", type: "~customType3"},
			hotspotId: "~element1",
			labelText: "~sLabel1"
		}]);

		oElement1Mock.expects("getId").withExactArgs().returns("~element1");
		oFieldHelpMock.expects("_updateHotspots").withExactArgs().returns(oUpdateHotspotsPromise);
		oUpdateHotspotsPromiseMock.expects("catch").withExactArgs(sinon.match.func).callThrough();

		// code under test - overwrites existing control URN, e.g. caused by switching the parent context
		oFieldHelp._setFieldHelpDocumentationRefs(oElement1, undefined, [
			"urn:sap-com:documentation:key?=type=~customType4&id=~customId4&origin=~origin4"
		]);

		oLabelEnablementMock.expects("_getLabelTexts").withExactArgs(sinon.match.same(oElement0)).returns(["~sLabel0"]);
		oLabelEnablementMock.expects("_getLabelTexts").withExactArgs(sinon.match.same(oElement1)).returns(["~sLabel1"]);

		// code under test
		assert.deepEqual(oFieldHelp._getFieldHelpHotspots(), [{
			backendHelpKey: {id: "~customId0", type: "~customType0"},
			hotspotId: "~element0",
			labelText: "~sLabel0"
		}, {
			backendHelpKey: {id: "~customId4", origin: "~origin4", type: "~customType4"},
			hotspotId: "~element1",
			labelText: "~sLabel1"
		}, {
			backendHelpKey: {id: "~customId3", type: "~customType3"},
			hotspotId: "~element1",
			labelText: "~sLabel1"
		}]);

		oElement1Mock.expects("getId").withExactArgs().returns("~element1");
		oFieldHelpMock.expects("_updateHotspots").withExactArgs().returns(oUpdateHotspotsPromise);
		oUpdateHotspotsPromiseMock.expects("catch").withExactArgs(sinon.match.func).callThrough();

		// code under test - delete URNs for the control
		oFieldHelp._setFieldHelpDocumentationRefs(oElement1, undefined, []);

		oElement1Mock.expects("getId").withExactArgs().returns("~element1");
		oFieldHelpMock.expects("_updateHotspots").withExactArgs().returns(oUpdateHotspotsPromise);
		oUpdateHotspotsPromiseMock.expects("catch").withExactArgs(sinon.match.func).callThrough();

		// code under test - delete URNs for a control property
		oFieldHelp._setFieldHelpDocumentationRefs(oElement1, "~property0", []);

		oLabelEnablementMock.expects("_getLabelTexts").withExactArgs(sinon.match.same(oElement0)).returns(["~sLabel0"]);
		oLabelEnablementMock.expects("_getLabelTexts").withExactArgs(sinon.match.same(oElement1)).returns(["~sLabel1"]);

		// code under test
		assert.deepEqual(oFieldHelp._getFieldHelpHotspots(), [{
			backendHelpKey: {id: "~customId0", type: "~customType0"},
			hotspotId: "~element0",
			labelText: "~sLabel0"
		}, {
			backendHelpKey: {id: "~customId3", type: "~customType3"},
			hotspotId: "~element1",
			labelText: "~sLabel1"
		}]);

		oElement1Mock.expects("getId").withExactArgs().returns("~element1");
		oFieldHelpMock.expects("_updateHotspots").withExactArgs().returns(oUpdateHotspotsPromise);
		oUpdateHotspotsPromiseMock.expects("catch").withExactArgs(sinon.match.func).callThrough();

		// code under test - remove all URNs of the last control property, of a control entry
		oFieldHelp._setFieldHelpDocumentationRefs(oElement1, "~property1", []);

		oLabelEnablementMock.expects("_getLabelTexts").withExactArgs(sinon.match.same(oElement0)).returns(["~sLabel0"]);

		// code under test
		assert.deepEqual(oFieldHelp._getFieldHelpHotspots(), [{
			backendHelpKey: {id: "~customId0", type: "~customType0"},
			hotspotId: "~element0",
			labelText: "~sLabel0"
		}]);

		oElement0Mock.expects("getId").withExactArgs().returns("~element0");
		oFieldHelpMock.expects("_updateHotspots").withExactArgs().returns(oUpdateHotspotsPromise);
		oUpdateHotspotsPromiseMock.expects("catch").withExactArgs(sinon.match.func).callThrough();

		// code under test - remove the last registered URN
		oFieldHelp._setFieldHelpDocumentationRefs(oElement0, undefined, []);

		// code under test
		assert.deepEqual(oFieldHelp._getFieldHelpHotspots(), []);
	});

	//*********************************************************************************************
	QUnit.test("_getFieldHelpHotspots: field help is displayed at another control", function (assert) {
		const oFieldHelp = new FieldHelp();
		const oFieldHelpMock = this.mock(oFieldHelp);

		const oElement0 = {getId() {return "~element0"; /*not mocked as not relevant for this test*/}};
		const oUpdateHotspotsPromise = {catch() {/*not mocked as not relevant for this test*/}};
		oFieldHelpMock.expects("_updateHotspots").withExactArgs().returns(oUpdateHotspotsPromise);
		oFieldHelp._setFieldHelpDocumentationRefs(oElement0, undefined, [
			"urn:sap-com:documentation:key?=type=~customType0&id=~customId0"
		]);
		const oElement1 = {getId() {return "~element1";}};
		oFieldHelpMock.expects("_updateHotspots").withExactArgs().returns(oUpdateHotspotsPromise);
		oFieldHelp._setFieldHelpDocumentationRefs(oElement1, undefined, [
			"urn:sap-com:documentation:key?=type=~customType1&id=~customId1&origin=~origin1"
		]);
		// Element2 has the same documentation ref as Element0 - does not appear in result
		const oElement2 = {getId() {return "~element2";}};
		oFieldHelpMock.expects("_updateHotspots").withExactArgs().returns(oUpdateHotspotsPromise);
		oFieldHelp._setFieldHelpDocumentationRefs(oElement2, undefined, [
			"urn:sap-com:documentation:key?=type=~customType0&id=~customId0"
		]);

		const oHeaderElement = {getId() {return "~HeaderElement";}};
		// HeaderElement has the same documentation ref as Element1 - does not appear twice in the result
		oFieldHelpMock.expects("_updateHotspots").withExactArgs().returns(oUpdateHotspotsPromise);
		oFieldHelp._setFieldHelpDocumentationRefs(oHeaderElement, undefined, [
			"urn:sap-com:documentation:key?=type=~customType1&id=~customId1&origin=~origin1"
		]);

		this.mock(Element).expects("getElementById").withExactArgs("~HeaderElement").exactly(4).returns(oHeaderElement);
		this.mock(LabelEnablement).expects("_getLabelTexts").withExactArgs(sinon.match.same(oHeaderElement))
			.exactly(4).returns(["~sLabel"]);
		oFieldHelpMock.expects("_getFieldHelpDisplayMapping").withExactArgs().atLeast(1)
			.returns({"~element0": "~HeaderElement", "~element1": "~HeaderElement", "~element2": "~HeaderElement"});

		// code under test - field helps of the 3 controls are shown for the header element due to the mapping
		assert.deepEqual(oFieldHelp._getFieldHelpHotspots(), [{
			backendHelpKey: {id: "~customId0", type: "~customType0"},
			hotspotId: "~HeaderElement",
			labelText: "~sLabel"
		}, {
			backendHelpKey: {id: "~customId1", origin: "~origin1", type: "~customType1"},
			hotspotId: "~HeaderElement",
			labelText: "~sLabel"
		}]);
	});

	//*********************************************************************************************
	QUnit.test("_getFieldHelpHotspots: no label found", function (assert) {
		const oFieldHelp = new FieldHelp();
		const oFieldHelpMock = this.mock(oFieldHelp);
		const oElement0 = {getId() {}};
		this.mock(oElement0).expects("getId").withExactArgs().returns("~element0");
		const oUpdateHotspotsPromise = Promise.resolve();
		oFieldHelpMock.expects("_updateHotspots").withExactArgs().returns(oUpdateHotspotsPromise);
		const sURNElement0 = "urn:sap-com:documentation:key?=type=~customType0&id=~customId0";
		oFieldHelp._setFieldHelpDocumentationRefs(oElement0, undefined, [sURNElement0]);
		const oElement1 = {getId() {}};
		this.mock(oElement1).expects("getId").withExactArgs().returns("~element1");
		const oUpdateHotspotsPromise1 = Promise.resolve();
		oFieldHelpMock.expects("_updateHotspots").withExactArgs().returns(oUpdateHotspotsPromise1);
		oFieldHelp._setFieldHelpDocumentationRefs(oElement1, undefined, [
			"urn:sap-com:documentation:key?=type=~customType1&id=~customId1"
		]);

		const oElementMock = this.mock(Element);
		oFieldHelpMock.expects("_getFieldHelpDisplayMapping").withExactArgs().returns({});
		oElementMock.expects("getElementById").withExactArgs("~element0").returns(oElement0);
		const oLabelEnablementMock = this.mock(LabelEnablement);
		oLabelEnablementMock.expects("_getLabelTexts").withExactArgs(sinon.match.same(oElement0)).returns([]);
		this.oLogMock.expects("error")
			.withExactArgs("Cannot find a label for control '~element0'; ignoring field help",
				`{"undefined":["${sURNElement0}"]}`, sClassName);
		oElementMock.expects("getElementById").withExactArgs("~element1").returns(oElement1);
		oLabelEnablementMock.expects("_getLabelTexts").withExactArgs(sinon.match.same(oElement1)).returns(["~sLabel"]);

		// code under test - only the control which has a label is added to the internal data structure
		assert.deepEqual(oFieldHelp._getFieldHelpHotspots(), [{
			backendHelpKey: {id: "~customId1", type: "~customType1"},
			hotspotId: "~element1",
			labelText: "~sLabel"
		}]);

		return Promise.all([oUpdateHotspotsPromise, oUpdateHotspotsPromise1]);
	});

	//*********************************************************************************************
	QUnit.test("_setFieldHelpDocumentationRefs: _updateHotspots rejects", function (assert) {
		const oFieldHelp = new FieldHelp();
		const oElement0 = {getId() {}};
		this.mock(oElement0).expects("getId").withExactArgs().returns("~element0");
		const oUpdateHotspotsPromise = Promise.reject(new Error("Update hotspots failed"));
		this.mock(oFieldHelp).expects("_updateHotspots").withExactArgs().returns(oUpdateHotspotsPromise);

		// code under test - set field help, but the update rejects as field help is deactivated in between
		oFieldHelp._setFieldHelpDocumentationRefs(oElement0, undefined, [
			"urn:sap-com:documentation:key?=type=~customType0&id=~customId0"
		]);

		return Promise.resolve().then(() => {/* wait until _updateHotspots is completely processed */});
	});

	//*********************************************************************************************
	QUnit.test("deactivate cleans internal data structure", function (assert) {
		const oFieldHelp = new FieldHelp();
		const oElement = {getId() {return "~element";}};
		const oUpdateHotspotsPromise = {catch() {}};
		const oUpdateHotspotsPromiseMock = this.mock(oUpdateHotspotsPromise);
		const oFieldHelpMock = this.mock(oFieldHelp);
		oFieldHelpMock.expects("_updateHotspots").withExactArgs().returns(oUpdateHotspotsPromise);
		// ensure that Promise is caught to avoid uncaught in Promise
		oUpdateHotspotsPromiseMock.expects("catch").withExactArgs(sinon.match.func).callThrough();
		oFieldHelp._setFieldHelpDocumentationRefs(oElement, undefined, [
			"urn:sap-com:documentation:key?=type=~customType&id=~customId"
		]);
		this.mock(Element).expects("getElementById").withExactArgs("~element").returns(oElement);
		this.mock(LabelEnablement).expects("_getLabelTexts").withExactArgs(sinon.match.same(oElement))
			.returns(["~sLabelText"]);
		oFieldHelpMock.expects("_getFieldHelpDisplayMapping").withExactArgs().returns({});

		assert.deepEqual(oFieldHelp._getFieldHelpHotspots(), [{
			backendHelpKey: {id: "~customId", type: "~customType"},
			hotspotId: "~element",
			labelText: "~sLabelText"
		}]);

		// code under test
		oFieldHelp.deactivate();

		oFieldHelpMock.expects("_getFieldHelpDisplayMapping").withExactArgs().returns({});

		assert.deepEqual(oFieldHelp._getFieldHelpHotspots(), []);
	});

	//*********************************************************************************************
	QUnit.test("deactivate clears mMetaModel2TextMappingPromise", function (assert) {
		const oFieldHelp = new FieldHelp();
		const oMetaModelInterface = {
			requestTypes() {}
		};
		const oInterfaceMock = this.mock(oMetaModelInterface);
		// assume no types to shorten the test
		oInterfaceMock.expects("requestTypes").withExactArgs().resolves([new Map(), new Map()]);

		// code under test: get promise for text mapping
		const oText2IdByTypePromise = FieldHelp._requestText2IdByType(oMetaModelInterface);

		// code under test: deactivate the field help => clear cache
		oFieldHelp.deactivate();

		oInterfaceMock.expects("requestTypes").withExactArgs().resolves([new Map(), new Map()]);

		// code under test: get promise for text mapping
		const oText2IdByTypePromise2 = FieldHelp._requestText2IdByType(oMetaModelInterface);

		assert.notStrictEqual(oText2IdByTypePromise, oText2IdByTypePromise2, "mMetaModel2TextMappingPromise cleared");
	});

	//*********************************************************************************************
[undefined, "/foo#meta", "/bar@annotation"].forEach((sResolvedPath) => {
	QUnit.test("_requestDocumentationRef: unsupported binding path: " + sResolvedPath, function (assert) {
		const oBinding = {
			getResolvedPath() {},
			isDestroyed() {}
		};
		this.mock(oBinding).expects("isDestroyed").withExactArgs().returns(false);
		this.mock(oBinding).expects("getResolvedPath").withExactArgs().returns(sResolvedPath);

		// code under test
		assert.strictEqual(FieldHelp._requestDocumentationRef(oBinding), undefined);
	});
});

	//*********************************************************************************************
	QUnit.test("_requestDocumentationRef: binding is being destroyed", function (assert) {
		const oBinding = {isDestroyed() {}};
		this.mock(oBinding).expects("isDestroyed").withExactArgs().returns(true);

		// code under test - binding is being destroyed
		assert.strictEqual(FieldHelp._requestDocumentationRef(oBinding), undefined);
	});

	//*********************************************************************************************
[
	{bHasModel: false}, // e.g. StaticBinding
	{bHasModel: true, oMetaModel: undefined},
	{bHasModel: true, oMetaModel: {/* no getMetaContext */}}
].forEach(({bHasModel, oMetaModel}, i) => {
	QUnit.test("_requestDocumentationRef: no meta model with getMetaContext, #" + i, function (assert) {
		const oBinding = {
			getModel() {},
			getResolvedPath() {},
			isDestroyed() {}
		};
		this.mock(oBinding).expects("isDestroyed").withExactArgs().returns(false);
		this.mock(oBinding).expects("getResolvedPath").withExactArgs().returns("/resolved/data/path");
		const oModel = {getMetaModel() {}};
		this.mock(oModel).expects("getMetaModel").withExactArgs().exactly(bHasModel ? 1 : 0). returns(oMetaModel);
		this.mock(oBinding).expects("getModel").withExactArgs().returns(bHasModel ? oModel : undefined);

		// code under test
		assert.strictEqual(FieldHelp._requestDocumentationRef(oBinding), undefined);
	});
});

	//*********************************************************************************************
[
	{bHasAnnotation: false, oPropertyMetadata: undefined}, // no metadata at all
	{bHasAnnotation: false, oPropertyMetadata: {}}, // metadata for meta context available, but no annotation
	{
		bHasAnnotation: true,
		oPropertyMetadata: {
			"com.sap.vocabularies.Common.v1.DocumentationRef": {String: "~DocumentationRefValue"}
		}
	}
].forEach(({bHasAnnotation, oPropertyMetadata}, i) => {
	QUnit.test("_requestDocumentationRef: V2 binding, #" + i, function (assert) {
		const oBinding = {
			getModel() {},
			getResolvedPath() {},
			isDestroyed() {}
		};
		this.mock(oBinding).expects("isDestroyed").withExactArgs().returns(false);
		this.mock(oBinding).expects("getResolvedPath").withExactArgs().returns("/resolved/data/path");
		const oModel = {getMetaModel() {}};
		const oMetaModel = {
			getMetaContext() {},
			getObject() {},
			isA() {},
			loaded() {}
		};
		this.mock(oModel).expects("getMetaModel").withExactArgs(). returns(oMetaModel);
		this.mock(oBinding).expects("getModel").withExactArgs().returns(oModel);
		this.mock(FieldHelp).expects("_getMetamodelInterface").withExactArgs(sinon.match.same(oMetaModel))
			.returns("~metaModelInterface");
		this.mock(FieldHelp).expects("_requestIDPropertyPath")
			.withExactArgs("~metaModelInterface", "/resolved/data/path")
			.resolves("/resolved/IDPath");
		this.mock(oMetaModel).expects("isA").withExactArgs("sap.ui.model.odata.ODataMetaModel").returns(true);
		this.mock(oMetaModel).expects("getMetaContext").withExactArgs("/resolved/IDPath").returns("~metaContext");
		this.mock(oMetaModel).expects("getObject").withExactArgs("", "~metaContext").returns(oPropertyMetadata);

		// code under test
		const oPromise = FieldHelp._requestDocumentationRef(oBinding);

		assert.ok(oPromise instanceof Promise);

		return oPromise.then((sDocumentationRefValue) => {
			assert.strictEqual(sDocumentationRefValue, bHasAnnotation ? "~DocumentationRefValue" : undefined);
		});
	});
});

	//*********************************************************************************************
	QUnit.test("_requestDocumentationRef: V2 binding, _requestIDPropertyPath rejects", function (assert) {
		const oBinding = {
			getModel() {},
			getResolvedPath() {},
			isDestroyed() {}
		};
		this.mock(oBinding).expects("isDestroyed").withExactArgs().returns(false);
		this.mock(oBinding).expects("getResolvedPath").withExactArgs().returns("/resolved/data/path");
		const oModel = {getMetaModel() {}};
		const oMetaModel = {
			getMetaContext() {},
			getObject() {},
			isA() {},
			loaded() {}
		};
		this.mock(oModel).expects("getMetaModel").withExactArgs(). returns(oMetaModel);
		this.mock(oBinding).expects("getModel").withExactArgs().returns(oModel);
		this.mock(FieldHelp).expects("_getMetamodelInterface").withExactArgs(sinon.match.same(oMetaModel))
			.returns("~metaModelInterface");
		const oError = new Error("~_requestIDPropertyPath rejected");
		this.mock(FieldHelp).expects("_requestIDPropertyPath")
			.withExactArgs("~metaModelInterface", "/resolved/data/path")
			.rejects(oError);
		this.mock(oMetaModel).expects("isA").withExactArgs("sap.ui.model.odata.ODataMetaModel").returns(true);
		this.oLogMock.expects("error")
			.withExactArgs("Failed to request 'com.sap.vocabularies.Common.v1.DocumentationRef' annotation for path "
				+ "'/resolved/data/path'", sinon.match.same(oError), sClassName);

		// code under test
		const oPromise = FieldHelp._requestDocumentationRef(oBinding);

		assert.ok(oPromise instanceof Promise);

		return oPromise.then((sDocumentationRefValue) => {
			assert.strictEqual(sDocumentationRefValue, undefined);
		});
	});

	//*********************************************************************************************
	QUnit.test("_requestDocumentationRef: V2 binding, error while fetching metadata", function (assert) {
		const oBinding = {
			getModel() {},
			getResolvedPath() {},
			isDestroyed() {}
		};
		this.mock(oBinding).expects("isDestroyed").withExactArgs().returns(false);
		this.mock(oBinding).expects("getResolvedPath").withExactArgs().returns("/resolved/data/path");
		const oModel = {getMetaModel() {}};
		const oMetaModel = {
			getMetaContext() {},
			getObject() {},
			isA() {},
			loaded() {}
		};
		this.mock(oModel).expects("getMetaModel").withExactArgs(). returns(oMetaModel);
		this.mock(oBinding).expects("getModel").withExactArgs().returns(oModel);
		this.mock(FieldHelp).expects("_getMetamodelInterface").withExactArgs(sinon.match.same(oMetaModel))
			.returns("~metaModelInterface");
		this.mock(FieldHelp).expects("_requestIDPropertyPath")
			.withExactArgs("~metaModelInterface", "/resolved/data/path")
			.resolves("/resolved/IDPath");
		this.mock(oMetaModel).expects("isA").withExactArgs("sap.ui.model.odata.ODataMetaModel").returns(true);
		this.mock(oMetaModel).expects("getMetaContext").withExactArgs("/resolved/IDPath").returns("~metaContext");
		const oError = new Error("Context cannot be determined");
		this.mock(oMetaModel).expects("getObject").withExactArgs("", "~metaContext").throws(oError);
		this.oLogMock.expects("error")
			.withExactArgs("Failed to request 'com.sap.vocabularies.Common.v1.DocumentationRef' annotation for path "
				+ "'/resolved/IDPath'", sinon.match.same(oError), sClassName);

		// code under test
		const oPromise = FieldHelp._requestDocumentationRef(oBinding);

		assert.ok(oPromise instanceof Promise);

		return oPromise.then((sDocumentationRefValue) => {
			assert.strictEqual(sDocumentationRefValue, undefined);
		});
	});

	//*********************************************************************************************
[false, true].forEach((bHasAnnotation) => {
	QUnit.test("_requestDocumentationRef: V4 binding, has annotation=" + bHasAnnotation, function (assert) {
		const oBinding = {
			getModel() {},
			getResolvedPath() {},
			isDestroyed() {}
		};
		this.mock(oBinding).expects("isDestroyed").withExactArgs().returns(false);
		this.mock(oBinding).expects("getResolvedPath").withExactArgs().returns("/resolved/data/path");
		const oModel = {getMetaModel() {}};
		const oMetaModel = {
			getMetaContext() {},
			isA() {},
			requestObject() {}
		};
		this.mock(oModel).expects("getMetaModel").withExactArgs(). returns(oMetaModel);
		this.mock(oBinding).expects("getModel").withExactArgs().returns(oModel);
		this.mock(FieldHelp).expects("_getMetamodelInterface").withExactArgs(sinon.match.same(oMetaModel))
			.returns("~metaModelInterface");
		this.mock(FieldHelp).expects("_requestIDPropertyPath")
			.withExactArgs("~metaModelInterface", "/resolved/data/path")
			.resolves("/resolved/IDPath");
		this.mock(oMetaModel).expects("isA").withExactArgs("sap.ui.model.odata.ODataMetaModel").returns(false);
		this.mock(oMetaModel).expects("getMetaContext").withExactArgs("/resolved/IDPath").returns("~metaContext");
		this.mock(oMetaModel).expects("requestObject")
			.withExactArgs("@com.sap.vocabularies.Common.v1.DocumentationRef", "~metaContext")
			.resolves(bHasAnnotation ? "~DocumentationRefValue" : undefined);

		// code under test
		const oPromise = FieldHelp._requestDocumentationRef(oBinding);

		assert.ok(oPromise instanceof Promise);

		return oPromise.then((sDocumentationRefValue) => {
			assert.strictEqual(sDocumentationRefValue, bHasAnnotation ? "~DocumentationRefValue" : undefined);
		});
	});
});

	//*********************************************************************************************
	QUnit.test("_requestDocumentationRef: V4 binding, requestObject rejects", function (assert) {
		const oBinding = {
			getModel() {},
			getResolvedPath() {},
			isDestroyed() {}
		};
		this.mock(oBinding).expects("isDestroyed").withExactArgs().returns(false);
		this.mock(oBinding).expects("getResolvedPath").withExactArgs().returns("/resolved/data/path");
		const oModel = {getMetaModel() {}};
		const oMetaModel = {
			getMetaContext() {},
			isA() {},
			requestObject() {}
		};
		this.mock(oModel).expects("getMetaModel").withExactArgs(). returns(oMetaModel);
		this.mock(oBinding).expects("getModel").withExactArgs().returns(oModel);
		this.mock(FieldHelp).expects("_getMetamodelInterface").withExactArgs(sinon.match.same(oMetaModel))
			.returns("~metaModelInterface");
		this.mock(FieldHelp).expects("_requestIDPropertyPath")
			.withExactArgs("~metaModelInterface", "/resolved/data/path")
			.resolves("/resolved/IDPath");
		this.mock(oMetaModel).expects("isA").withExactArgs("sap.ui.model.odata.ODataMetaModel").returns(false);
		this.mock(oMetaModel).expects("getMetaContext").withExactArgs("/resolved/IDPath").returns("~metaContext");
		const oError = new Error("~requestObjectRejected");
		this.mock(oMetaModel).expects("requestObject")
			.withExactArgs("@com.sap.vocabularies.Common.v1.DocumentationRef", "~metaContext")
			.rejects(oError);
		this.oLogMock.expects("error")
			.withExactArgs("Failed to request 'com.sap.vocabularies.Common.v1.DocumentationRef' annotation for path "
				+ "'/resolved/IDPath'", sinon.match.same(oError), sClassName);

		// code under test
		const oPromise = FieldHelp._requestDocumentationRef(oBinding);

		assert.ok(oPromise instanceof Promise);

		return oPromise.then((sDocumentationRefValue) => {
			assert.strictEqual(sDocumentationRefValue, undefined);
		});
	});

	//*********************************************************************************************
	QUnit.test("_getFieldHelpDisplayMapping: no documentation refs available", function (assert) {
		const oFieldHelp = FieldHelp.getInstance();

		// code under test
		assert.deepEqual(oFieldHelp._getFieldHelpDisplayMapping(), {});
	});

	//*********************************************************************************************
	QUnit.test("_getFieldHelpDisplayMapping: destroyed control", function (assert) {
		const oFieldHelp = new FieldHelp();
		const oElement0 = {
			getAssociation() {},
			getId() {},
			getParent() {}
		};
		this.mock(oElement0).expects("getId").withExactArgs().returns("~element0");
		const oUpdateHotspotsPromise = {catch() {}};
		this.mock(oFieldHelp).expects("_updateHotspots").withExactArgs().returns(oUpdateHotspotsPromise);
		this.mock(oUpdateHotspotsPromise).expects("catch").withExactArgs(sinon.match.func);
		oFieldHelp._setFieldHelpDocumentationRefs(oElement0, undefined, [
			"urn:sap-com:documentation:key?=type=~customType0&id=~customId0"
		]);

		const oElementMock = this.mock(Element);
		oElementMock.expects("getElementById").withExactArgs("~element0").returns(oElement0);
		this.mock(oElement0).expects("getAssociation").withExactArgs("fieldHelpDisplay").returns("~associationId");
		this.mock(oElement0).expects("getParent").withExactArgs().returns(null);

		// code under test - initially the mapping is defined
		assert.deepEqual(oFieldHelp._getFieldHelpDisplayMapping(), {"~element0": "~associationId"});

		// simulate that the control has been destroyed
		oElementMock.expects("getElementById").withExactArgs("~element0").returns(undefined);

		// code under test - control was destroyed in between
		assert.deepEqual(oFieldHelp._getFieldHelpDisplayMapping(), {});

		// code under test - the destroyed control has been removed from internal data structure -> no getElementById
		assert.deepEqual(oFieldHelp._getFieldHelpDisplayMapping(), {});
	});

	//*********************************************************************************************
	QUnit.test("_getFieldHelpDisplayMapping", function (assert) {
		const oFieldHelp = FieldHelp.getInstance();
		const oUpdateHotspotsPromise = {catch() {}};
		const oFieldHelpMock = this.mock(oFieldHelp);
		oFieldHelpMock.expects("_updateHotspots").withExactArgs().returns(oUpdateHotspotsPromise);
		const oUpdateHotspotsPromiseMock = this.mock(oUpdateHotspotsPromise);
		oUpdateHotspotsPromiseMock.expects("catch").withExactArgs(sinon.match.func);
		// Element 1 has both a fieldHelpDisplay association and a BindingInfo.OriginalParent
		// -> fieldHelpDisplay association wins
		const oElement0 = {
			[BindingInfo.OriginalParent]: {
				getId() { return "oOriginalParent0"; }
			},
			getAssociation() {},
			getId() {},
			getParent() {}
		};
		this.mock(oElement0).expects("getId").withExactArgs().returns("~id0");
		oFieldHelp._setFieldHelpDocumentationRefs(oElement0, undefined, [
			"urn:sap-com:documentation:key?=type=~customType0&id=~customId0"
		]);
		oFieldHelpMock.expects("_updateHotspots").withExactArgs().returns(oUpdateHotspotsPromise);
		oUpdateHotspotsPromiseMock.expects("catch").withExactArgs(sinon.match.func);
		const oOriginalParent = {getId() {}};
		// Element 1 has no fieldHelpDisplay association but a BindingInfo.OriginalParent
		const oElement1 = {
			[BindingInfo.OriginalParent]: oOriginalParent,
			getAssociation() {},
			getId() {},
			getParent() {}
		};
		this.mock(oElement1).expects("getId").withExactArgs().returns("~id1");
		oFieldHelp._setFieldHelpDocumentationRefs(oElement1, undefined, [
			"urn:sap-com:documentation:key?=type=~customType1&id=~customId1"
		]);
		// Element 2 has neither a fieldHelpDisplay association nor a BindingInfo.OriginalParent
		const oElement2 = {getAssociation() {}, getId() {}, getParent() {}};
		oFieldHelpMock.expects("_updateHotspots").withExactArgs().returns(oUpdateHotspotsPromise);
		oUpdateHotspotsPromiseMock.expects("catch").withExactArgs(sinon.match.func);
		this.mock(oElement2).expects("getId").withExactArgs().returns("~id2");
		oFieldHelp._setFieldHelpDocumentationRefs(oElement2, undefined, [
			"urn:sap-com:documentation:key?=type=~customType2&id=~customId2"
		]);
		// Element 3 has neither a fieldHelpDisplay association nor a BindingInfo.OriginalParent;
		// its parent has a fieldHelpDisplay association
		const oElement3 = {getAssociation() {}, getId() {}, getParent() {}};
		oFieldHelpMock.expects("_updateHotspots").withExactArgs().returns(oUpdateHotspotsPromise);
		oUpdateHotspotsPromiseMock.expects("catch").withExactArgs(sinon.match.func);
		this.mock(oElement3).expects("getId").withExactArgs().returns("~id3");
		oFieldHelp._setFieldHelpDocumentationRefs(oElement3, undefined, [
			"urn:sap-com:documentation:key?=type=~customType3&id=~customId3"
		]);

		const oElementMock = this.mock(Element);
		oElementMock.expects("getElementById").withExactArgs("~id0").returns(oElement0);
		this.mock(oElement0).expects("getAssociation").withExactArgs("fieldHelpDisplay").returns("~sAssociationId0");
		this.mock(oElement0).expects("getParent").withExactArgs().returns("~oParentControl0");
		oElementMock.expects("getElementById").withExactArgs("~id1").returns(oElement1);
		this.mock(oElement1).expects("getAssociation").withExactArgs("fieldHelpDisplay").returns(null);
		this.mock(oOriginalParent).expects("getId").withExactArgs().returns("~originalParentId");
		this.mock(oElement1).expects("getParent").withExactArgs().returns("~oParentControl1");
		oElementMock.expects("getElementById").withExactArgs("~id2").returns(oElement2);
		this.mock(oElement2).expects("getAssociation").withExactArgs("fieldHelpDisplay").returns(null);
		this.mock(oElement2).expects("getParent").withExactArgs().returns(null);
		oElementMock.expects("getElementById").withExactArgs("~id3").returns(oElement3);
		this.mock(oElement3).expects("getAssociation").withExactArgs("fieldHelpDisplay").returns(null);
		const oElement3Parent = {getAssociation() {}, getParent() {}};
		this.mock(oElement3).expects("getParent").withExactArgs().returns(oElement3Parent);
		this.mock(oElement3Parent).expects("getAssociation")
			.withExactArgs("fieldHelpDisplay")
			.returns("~sParentAssociationId");
		this.mock(oElement3Parent).expects("getParent").withExactArgs().returns(null);

		// code under test
		assert.deepEqual(oFieldHelp._getFieldHelpDisplayMapping(),
			{"~id0": "~sAssociationId0", "~id1": "~originalParentId", "~id3": "~sParentAssociationId"});
	});

	//*********************************************************************************************
[true, false].forEach((bFieldHelpActive) => {
	const sTitle = "updateFieldHelp: ManagedObjectBindingSupport#_unbindProperty: field help is active: "
		+ bFieldHelpActive;
	QUnit.test(sTitle, function () {
		const oBindingInfo = {
			binding: {destroy() {}}
		};
		const oManagedObject = {_detachPropertyBindingHandlers() {}};
		this.mock(oManagedObject).expects("_detachPropertyBindingHandlers").withExactArgs("~sControlProperty");
		this.mock(oBindingInfo.binding).expects("destroy").withExactArgs();
		if (bFieldHelpActive) {
			oManagedObject.updateFieldHelp = () => {};
			this.mock(oManagedObject).expects("updateFieldHelp").withExactArgs("~sControlProperty");
		}

		// code under test
		ManagedObjectBindingSupport._unbindProperty.call(oManagedObject, oBindingInfo, "~sControlProperty");
	});
});

	//*********************************************************************************************
[true, false].forEach((bFieldHelpActive) => {
	[true, false].forEach((bFactory) => {
	const sTitle = "updateFieldHelp: ManagedObjectBindingSupport#updateBindingContext: "
		+ (bFactory ? "binding with factory" : "simple binding for the given model")
		+ "; field help is active: " + bFieldHelpActive;
	QUnit.test(sTitle, function () {
		const oBinding = {setContext() {}};
		const oManagedObject = {
			mObjectBindingInfos: {},
			mBindingInfos: {
				"~sControlProperty": {
					binding: oBinding,
					factory: bFactory,
					model: undefined,
					parts: [{model: undefined}]
				}
			},
			getModel() {},
			getBindingContext() {}
		};
		this.mock(oManagedObject).expects("getModel").withExactArgs(undefined).returns("~oModel");
		this.mock(oManagedObject).expects("getBindingContext").withExactArgs(undefined).returns("~oContext");
		this.mock(oBinding).expects("setContext").withExactArgs("~oContext");
		if (bFieldHelpActive) {
			oManagedObject.updateFieldHelp = () => {};
			this.mock(oManagedObject).expects("updateFieldHelp").withExactArgs("~sControlProperty");
		}

		// code under test
		ManagedObjectBindingSupport.updateBindingContext.call(oManagedObject, /*bSkipLocal*/true,
			/*sFixedModelName*/undefined, /*bUpdateAll*/false);
	});
	});
});

	//*********************************************************************************************
	QUnit.test("updateFieldHelp: ManagedObjectBindingSupport#updateBindingContext: factory for a different model",
			function () {
		const oBinding = {setContext() {}};
		const oManagedObject = {
			mObjectBindingInfos: {},
			mBindingInfos: {
				"~sControlProperty": {
					binding: oBinding,
					factory: true,
					model: "~otherModel"
				}
			},
			getModel() {},
			getBindingContext() {},
			updateFieldHelp() {}
		};
		this.mock(oManagedObject).expects("getModel").withExactArgs(undefined).returns("~oModel");
		this.mock(oManagedObject).expects("getBindingContext").withExactArgs(undefined).returns("~oContext");
		this.mock(oManagedObject).expects("updateFieldHelp").never();

		// code under test
		ManagedObjectBindingSupport.updateBindingContext.call(oManagedObject, /*bSkipLocal*/true,
			/*sFixedModelName*/undefined, /*bUpdateAll*/false);
	});

	//*********************************************************************************************
[true, false].forEach((bFieldHelpActive) => {
	const sTitle = "updateFieldHelp: ManagedObjectBindingSupport#updateBindingContext: composite binding;"
		+ " field help is active: " + bFieldHelpActive;
	QUnit.test(sTitle, function () {
		const oBinding = new CompositeBinding([]);
		const oManagedObject = {
			mObjectBindingInfos: {},
			mBindingInfos: {
				"~sControlProperty": {
					binding: oBinding,
					parts: [{model: undefined}]
				}
			},
			getModel() {},
			getBindingContext() {}
		};
		this.mock(oManagedObject).expects("getModel").withExactArgs(undefined).returns("~oModel");
		this.mock(oManagedObject).expects("getBindingContext").withExactArgs(undefined).returns("~oContext");
		this.mock(oBinding).expects("setContext").withExactArgs("~oContext", {fnIsBindingRelevant: sinon.match.func});
		if (bFieldHelpActive) {
			oManagedObject.updateFieldHelp = () => {};
			this.mock(oManagedObject).expects("updateFieldHelp").withExactArgs("~sControlProperty");
		}

		// code under test
		ManagedObjectBindingSupport.updateBindingContext.call(oManagedObject, /*bSkipLocal*/true,
			/*sFixedModelName*/undefined, /*bUpdateAll*/false);
	});
});

	//*********************************************************************************************
	QUnit.test("updateFieldHelp: ManagedObjectBindingSupport#updateBindingContext: binding not relevant", function () {
		const oManagedObject = {
			mObjectBindingInfos: {},
			mBindingInfos: {
				"~sControlProperty": {
					binding: {},
					parts: [{model: "~otherModel"}]
				}
			},
			getModel() {},
			getBindingContext() {},
			updateFieldHelp() {}
		};
		this.mock(oManagedObject).expects("getModel").withExactArgs(undefined).returns("~oModel");
		this.mock(oManagedObject).expects("getBindingContext").withExactArgs(undefined).returns("~oContext");
		this.mock(oManagedObject).expects("updateFieldHelp").never();

		// code under test
		ManagedObjectBindingSupport.updateBindingContext.call(oManagedObject, /*bSkipLocal*/true,
			/*sFixedModelName*/undefined, /*bUpdateAll*/false);
	});

	//*********************************************************************************************
[true, false].forEach((bFieldHelpActive) => {
	const sTitle = "updateFieldHelp: ManagedObjectBindingSupport#_bindProperty: field help is active: "
		+ bFieldHelpActive;
	QUnit.test(sTitle, function () {
		const oBindingInfo = {
			parts: [{mode: "~mode", model: "~model", path: "~path"}]
		};
		const oManagedObject = {
			getBindingContext() {},
			getMetadata() {},
			getModel() {}
		};
		const oMetadata = {getPropertyLikeSetting() {}};
		this.mock(oManagedObject).expects("getMetadata").withExactArgs().returns(oMetadata);
		const oPropertyInfo = {_iKind: /* PROPERTY */ 0, type: "~propertyType"};
		this.mock(oMetadata).expects("getPropertyLikeSetting").withExactArgs("~sProperty").returns(oPropertyInfo);
		this.mock(oManagedObject).expects("getBindingContext").withExactArgs("~model").returns("~oContext");
		const oModel = {bindProperty() {}};
		this.mock(oManagedObject).expects("getModel").withExactArgs("~model").returns(oModel);
		const oBinding = {
			attachChange() {},
			attachEvents() {},
			initialize() {},
			setBindingMode() {},
			setFormatter() {},
			setType() {}
		};
		const oBindingMock = this.mock(oBinding);
		this.mock(oModel).expects("bindProperty").withExactArgs("~path", "~oContext", undefined).returns(oBinding);
		oBindingMock.expects("setType").withExactArgs(undefined, "~propertyType");
		oBindingMock.expects("setFormatter").withExactArgs(undefined);
		oBindingMock.expects("setBindingMode").withExactArgs("~mode");
		oBindingMock.expects("attachEvents").withExactArgs(undefined);
		oBindingMock.expects("attachChange").withExactArgs(sinon.match.func);
		oBindingMock.expects("attachEvents").withExactArgs(undefined);
		oBindingMock.expects("initialize").withExactArgs();
		if (bFieldHelpActive) {
			oManagedObject.updateFieldHelp = () => {};
			this.mock(oManagedObject).expects("updateFieldHelp").withExactArgs("~sProperty");
		}

		// code under test
		ManagedObjectBindingSupport._bindProperty.call(oManagedObject, "~sProperty", oBindingInfo);
	});
});

	//*********************************************************************************************
	QUnit.test("updateFieldHelp: update element if no property name is given (e.g. filter fields)", function () {
		const oFieldHelp = FieldHelp.getInstance();
		oFieldHelp.activate();
		const oElement = {};
		this.mock(oFieldHelp).expects("_updateElement").withExactArgs(sinon.match.same(oElement));

		// code under test
		ManagedObject.prototype.updateFieldHelp.call(oElement);
	});

	//*********************************************************************************************
[true, false].forEach((bV4) => {
	QUnit.test(`_getMetamodelInterface, OData ${bV4 ? "V4" : "V2"}`, function (assert) {
		const oMetaModel = {
			isA() {}
		};

		const oMetaModelMock = this.mock(oMetaModel);
		oMetaModelMock.expects("isA").withExactArgs("sap.ui.model.odata.v4.ODataMetaModel").returns(bV4);

		// code under test
		const oInterface = FieldHelp._getMetamodelInterface(oMetaModel);

		["getProperties", "getTextPropertyPath", "getTypeQName", "requestTypes"].forEach((sFunctionName) => {
			assert.strictEqual(typeof oInterface[sFunctionName], "function", "interface has function " + sFunctionName);
		});
		assert.strictEqual(oInterface.oMetaModel, oMetaModel);

		const oMetaModel2 = {
			isA() {}
		};
		this.mock(oMetaModel2).expects("isA").withExactArgs("sap.ui.model.odata.v4.ODataMetaModel").returns(bV4);

		// code under test: returns different interface instance when calling again
		const oInterface2 = FieldHelp._getMetamodelInterface(oMetaModel2);

		assert.strictEqual(oInterface2.oMetaModel, oMetaModel2);
		assert.notStrictEqual(oInterface, oInterface2);
	});
});

	//*********************************************************************************************
	QUnit.test("Metamodel interface V4: requestTypes", async function (assert) {
		const oMetaModel = {
			isA() {},
			requestObject() {}
		};

		const oMetaModelMock = this.mock(oMetaModel);
		oMetaModelMock.expects("isA").withExactArgs("sap.ui.model.odata.v4.ODataMetaModel").returns(true);
		const oInterface = FieldHelp._getMetamodelInterface(oMetaModel);
		oMetaModelMock.expects("requestObject").withExactArgs("/$").resolves({
			"C0": {$kind: "ComplexType"},
			"E0": {$kind: "EntityType"}, "E1": {$kind: "EntityType"},
			"Schema": {$kind: "Schema"}
		});

		// code under test
		const oTypesPromise = oInterface.requestTypes();

		assert.ok(oTypesPromise instanceof Promise, "requestTypes returns promise");
		let [mEntityTypes, mComplexTypes] = await oTypesPromise;
		assert.ok(mEntityTypes instanceof Map, "entity types are returned as map");
		assert.ok(mComplexTypes instanceof Map, "complex types are returned as map");
		assert.deepEqual(Array.from(mEntityTypes),
			[["E0", {$kind: "EntityType"}], ["E1", {$kind: "EntityType"}]]);
		assert.deepEqual(Array.from(mComplexTypes), [["C0", {$kind: "ComplexType"}]]);

		oMetaModelMock.expects("requestObject").withExactArgs("/$").resolves({/* no types */});

		// code under test: if no (complex) type is available, return empty map, not undefined
		[mEntityTypes, mComplexTypes] = await oInterface.requestTypes();

		assert.ok(mEntityTypes instanceof Map, "no entity types -> empty map");
		assert.ok(mComplexTypes instanceof Map, "no complex types -> empty map");
	});

	//*********************************************************************************************
	QUnit.test("Metamodel interface V4: getProperties", function (assert) {
		const oMetaModel = {
			isA() {}
		};

		const oMetaModelMock = this.mock(oMetaModel);
		oMetaModelMock.expects("isA").withExactArgs("sap.ui.model.odata.v4.ODataMetaModel").returns(true);
		const oInterface = FieldHelp._getMetamodelInterface(oMetaModel);
		const oType = {
			"NP0": {$kind: "NavigationProperty"},
			"P0": {$kind: "Property"}, "P1": {$kind: "Property"}
		};

		// code under test
		assert.deepEqual(oInterface.getProperties(oType), ["P0", "P1"]);
	});

	//*********************************************************************************************
	QUnit.test("Metamodel interface V4: getTextPropertyPath", function (assert) {
		const oMetaModel = {
			isA() {},
			getObject() {}
		};

		const oMetaModelMock = this.mock(oMetaModel);
		oMetaModelMock.expects("isA").withExactArgs("sap.ui.model.odata.v4.ODataMetaModel").returns(true);
		const oInterface = FieldHelp._getMetamodelInterface(oMetaModel);
		oMetaModelMock.expects("getObject")
			.withExactArgs("/~TypeName/~PropertyName@com.sap.vocabularies.Common.v1.Text/$Path")
			.returns("~TextPropertyPath");

		// code under test
		assert.strictEqual(oInterface.getTextPropertyPath("~TypeName", "~PropertyName"), "~TextPropertyPath");
	});

	//*********************************************************************************************
	QUnit.test("Metamodel interface V4: getTypeQName", function (assert) {
		const oMetaModel = {
			isA() {},
			getMetaPath() {},
			getObject() {}
		};

		const oMetaModelMock = this.mock(oMetaModel);
		oMetaModelMock.expects("isA").withExactArgs("sap.ui.model.odata.v4.ODataMetaModel").returns(true);
		const oInterface = FieldHelp._getMetamodelInterface(oMetaModel);
		oMetaModelMock.expects("getMetaPath").withExactArgs("/resolvedPath").returns("/metaPath");
		oMetaModelMock.expects("getObject").withExactArgs("/metaPath/$Type").returns("~typeQName");

		// code under test
		assert.strictEqual(oInterface.getTypeQName("/resolvedPath"), "~typeQName");
	});

	//*********************************************************************************************
	QUnit.test("Metamodel interface V2: requestTypes", async function (assert) {
		const oMetaModel = {
			getObject() {},
			isA() {},
			loaded() {}
		};

		const oMetaModelMock = this.mock(oMetaModel);
		oMetaModelMock.expects("isA").withExactArgs("sap.ui.model.odata.v4.ODataMetaModel").returns(false);
		const oInterface = FieldHelp._getMetamodelInterface(oMetaModel);
		const {promise: oLoadedPromise, resolve: fnResolve} = Promise.withResolvers();
		oMetaModelMock.expects("loaded").withExactArgs().returns(oLoadedPromise);
		oMetaModelMock.expects("getObject").never(); // only access metamodel when loaded

		// code under test
		const oTypesPromise = oInterface.requestTypes();

		assert.ok(oTypesPromise instanceof Promise, "requestTypes returns promise");

		oMetaModelMock.expects("getObject").withExactArgs("/dataServices/schema/0").returns({
			entityType: [{name: "E0", namespace: "name.space"}, {name: "E1", namespace: "name.space"}],
			complexType: [{name: "C0", namespace: "name.space"}]
		});

		fnResolve();

		const [mEntityTypes, mComplexTypes] = await oTypesPromise;
		assert.ok(mEntityTypes instanceof Map, "entity types are returned as map");
		assert.ok(mComplexTypes instanceof Map, "complex types are returned as map");
		assert.deepEqual(Array.from(mEntityTypes), [
			["name.space.E0", {name: "E0", namespace: "name.space"}],
			["name.space.E1", {name: "E1", namespace: "name.space"}]
		]);
		assert.deepEqual(Array.from(mComplexTypes), [
			["name.space.C0", {name: "C0", namespace: "name.space"}]
		]);

		const oLoadedPromise2 = Promise.resolve();
		oMetaModelMock.expects("loaded").withExactArgs().returns(oLoadedPromise2);
		oMetaModelMock.expects("getObject").withExactArgs("/dataServices/schema/0").returns({});

		// code under test: metamodel w/o entity types and complex types (return maps instead of undefined)
		const oTypesPromise2 = oInterface.requestTypes();

		const [mEntityTypes2, mComplexTypes2] = await oTypesPromise2;
		assert.deepEqual(Array.from(mEntityTypes2), []);
		assert.deepEqual(Array.from(mComplexTypes2), []);

	});

	//*********************************************************************************************
	QUnit.test("Metamodel interface V2: getProperties", function (assert) {
		const oMetaModel = {
			isA() {}
		};

		const oMetaModelMock = this.mock(oMetaModel);
		oMetaModelMock.expects("isA").withExactArgs("sap.ui.model.odata.v4.ODataMetaModel").returns(false);
		const oInterface = FieldHelp._getMetamodelInterface(oMetaModel);
		const oType = {
			navigationProperty: [{name: "NP0"}],
			property: [{name: "P0"}, {name: "P1"}]
		};

		// code under test
		assert.deepEqual(oInterface.getProperties(oType), ["P0", "P1"]);

		const oType2 = {
			navigationProperty: [{name: "NP0"}]
		};

		// code under test: type without properties
		assert.deepEqual(oInterface.getProperties(oType2), []);
	});


	//*********************************************************************************************
["entityType", "complexType"].forEach((sKindOfType) => {
	QUnit.test(`Metamodel interface V2: getTextPropertyPath, ${sKindOfType}`, function (assert) {
		const oMetaModel = {
			isA() {},
			getObject() {}
		};
		const bComplex = sKindOfType === "complexType";

		const oMetaModelMock = this.mock(oMetaModel);
		oMetaModelMock.expects("isA").withExactArgs("sap.ui.model.odata.v4.ODataMetaModel").returns(false);
		const oInterface = FieldHelp._getMetamodelInterface(oMetaModel);
		oMetaModelMock.expects("getObject")
			.withExactArgs(`/dataServices/schema/0/${sKindOfType}/typeIndex/property/propertyIndex`
				+ "/com.sap.vocabularies.Common.v1.Text")
			.returns({Path: "~TextPropertyPath"});

		// code under test
		assert.strictEqual(
			oInterface.getTextPropertyPath("typeName", "propertyName", "typeIndex", "propertyIndex", bComplex),
			"~TextPropertyPath");

		oMetaModelMock.expects("getObject")
			.withExactArgs(`/dataServices/schema/0/${sKindOfType}/typeIndex/property/propertyIndex`
				+ "/com.sap.vocabularies.Common.v1.Text")
			.returns(undefined);

		// code under test: property has no Text annotation
		assert.strictEqual(
			oInterface.getTextPropertyPath("typeName", "propertyName", "typeIndex", "propertyIndex", bComplex),
			undefined);
	});
});

	//*********************************************************************************************
	QUnit.test("Metamodel interface V2: getTypeQName", function (assert) {
		const oMetaModel = {
			isA() {},
			getMetaContext() {},
			getObject() {}
		};

		const oMetaModelMock = this.mock(oMetaModel);
		oMetaModelMock.expects("isA").withExactArgs("sap.ui.model.odata.v4.ODataMetaModel").returns(false);
		const oInterface = FieldHelp._getMetamodelInterface(oMetaModel);
		oMetaModelMock.expects("getMetaContext").withExactArgs("/BusinessPartnerSet('42')").returns("~oMetaContext");
		// entity types in metamodel JSON always have QName as namespace and name
		const oEntityType = {namespace: "name.space", name: "BusinessPartner"};
		oMetaModelMock.expects("getObject").withExactArgs("", "~oMetaContext").returns(oEntityType);

		// code under test: entity type
		assert.strictEqual(oInterface.getTypeQName("/BusinessPartnerSet('42')"), "name.space.BusinessPartner");

		oMetaModelMock.expects("getMetaContext").withExactArgs("/BusinessPartnerSet('42')/Address")
			.returns("~oMetaContext");
		// entity types in metamodel JSON always have QName as namespace and name
		const oComplexType = {type: "name.space.CT_Address"};
		oMetaModelMock.expects("getObject").withExactArgs("", "~oMetaContext").returns(oComplexType);

		// code under test: complex type
		assert.strictEqual(oInterface.getTypeQName("/BusinessPartnerSet('42')/Address"), "name.space.CT_Address");

		oMetaModelMock.expects("getMetaContext").withExactArgs("/resolvedPath").returns("~oMetaContext");
		oMetaModelMock.expects("getObject").withExactArgs("", "~oMetaContext").returns({name: "property"});

		// code under test: undefined, if neither entity type nor complex type
		assert.strictEqual(oInterface.getTypeQName("/resolvedPath"), undefined);

		const oCause = new Error("Invalid path");
		oMetaModelMock.expects("getMetaContext").withExactArgs("/invalidPath").throws(oCause);
		const oError = new Error("Failed to determine type QName for path '/invalidPath'");
		oError.cause = oCause;

		assert.throws(() => {
			// code under test: getMetaContext fails with invalid path, error is propagated
			oInterface.getTypeQName("/invalidPath");
		}, (oError) => {
			assert.ok(oError instanceof Error);
			assert.strictEqual(oError.message, "Failed to determine type QName for path '/invalidPath'");
			assert.strictEqual(oError.cause, oCause);
			return true;
		});
	});

	//*********************************************************************************************
	QUnit.test("_requestText2IdByType", async function (assert) {
		const oMetaModelInterface = {
			getProperties() {},
			getTextPropertyPath() {},
			requestTypes() {}
		};
		const oInterfaceMock = this.mock(oMetaModelInterface);
		oInterfaceMock.expects("requestTypes").withExactArgs().resolves([
			new Map([["E0", "~oEntityType0"], ["E1", "~oEntityType1"]]),
			new Map([["C0", "~oComplexType0"]])
		]);
		["~oEntityType0", "~oEntityType1", "~oComplexType0"].forEach((oType, i) => {
			oInterfaceMock.expects("getProperties").withExactArgs(oType).returns([`P${i}_0`, `P${i}_1`]);
		});
		oInterfaceMock.expects("getTextPropertyPath").withExactArgs("E0", "P0_0", 0, 0, false).returns("Text0");
		oInterfaceMock.expects("getTextPropertyPath").withExactArgs("E0", "P0_1", 0, 1, false).returns("Text1");
		oInterfaceMock.expects("getTextPropertyPath").withExactArgs("E1", "P1_0", 1, 0, false).returns(undefined);
		oInterfaceMock.expects("getTextPropertyPath").withExactArgs("E1", "P1_1", 1, 1, false).returns(undefined);
		oInterfaceMock.expects("getTextPropertyPath").withExactArgs("C0", "P2_0", 0, 0, true).returns("Text0");
		oInterfaceMock.expects("getTextPropertyPath").withExactArgs("C0", "P2_1", 0, 1, true).returns(undefined);

		// code under test
		const oText2IdByTypePromise = FieldHelp._requestText2IdByType(oMetaModelInterface);

		// code under test: promise is cached
		const oText2IdByTypePromise2 = FieldHelp._requestText2IdByType(oMetaModelInterface);

		assert.strictEqual(oText2IdByTypePromise, oText2IdByTypePromise2, "promise is cached");

		const mText2IdByType = await oText2IdByTypePromise;
		assert.strictEqual(mText2IdByType.size, 2, "two text property paths");
		assert.deepEqual(Array.from(mText2IdByType.get("Text0")), [["E0", "P0_0"], ["C0", "P2_0"]]);
		assert.deepEqual(Array.from(mText2IdByType.get("Text1")), [["E0", "P0_1"]]);
	});

	//*********************************************************************************************
[{ // SalesOrder: (text) "DeliveryStatusDescription" --> (ID) "DeliveryStatus"
	idPath: "/SalesOrderSet('42')/DeliveryStatus", // expected result: adapted resolved path with ID property
	path: "/SalesOrderSet('42')/DeliveryStatusDescription", // input: resolved path
	prefixes2Type: [["/SalesOrderSet('42')", "SalesOrder"]] // for path prefixes considered: path prefix -> type name
}, { // BusinessPartner: (text) "Name" -> (ID) "BusinessPartner_ID"
	idPath: "/SalesOrderSet('42')/BusinessPartner_ID",
	path: "/SalesOrderSet('42')/ToBusinessPartner/Name",
	prefixes2Type: [["/SalesOrderSet('42')", "SalesOrder"]]
}, { // SalesOrder: (text) "ToBusinessPartner/Name" -> (ID) "BusinessPartner_ID"
	idPath: "/SalesOrderSet('42')/BusinessPartner_ID",
	path: "/SalesOrderSet('42')/ToBusinessPartner/Name",
	prefixes2Type: [["/SalesOrderSet('42')", "SalesOrder"]]
}, { // Product: (text) "Name" -> (ID) "Product_ID"
	idPath: "/SalesOrderSet('42')/ToBusinessPartner/ToProduct/Product_ID",
	path: "/SalesOrderSet('42')/ToBusinessPartner/ToProduct/Name",
	prefixes2Type: [
		["/SalesOrderSet('42')", "SalesOrder"],
		["/SalesOrderSet('42')/ToBusinessPartner", "BusinessPartner"],
		["/SalesOrderSet('42')/ToBusinessPartner/ToProduct", "Product"]
	]
}, { // SalesOrder: not a text property -> return unchanged path
	idPath: "/SalesOrderSet('42')/Note",
	path: "/SalesOrderSet('42')/Note",
	prefixes2Type: [
		["/SalesOrderSet('42')", "SalesOrder"]
	]
}, { // invalid path
	idPath: "/some/invalid/path",
	path: "/some/invalid/path",
	prefixes2Type: [
		["/some", undefined],
		["/some/invalid", undefined]
	]
}].forEach(({idPath: sIDPath, path: sPath, prefixes2Type: mPrefix2Type}) => {
	QUnit.test(`_requestIDPropertyPath: ${sPath}`, async function (assert) {
		const oMetaModelInterface = {
			getTypeQName() {}
		};
		const mText2IdByType = new Map([
			["DeliveryStatusDescription",  new Map([["SalesOrder", "DeliveryStatus"]])],
			["Name", new Map([["BusinessPartner", "BP_ID"], ["Product", "Product_ID"]])],
			["ToBusinessPartner/Name", new Map([["SalesOrder", "BusinessPartner_ID"]])]
		]);
		const oInterfaceMock = this.mock(oMetaModelInterface);
		const oFieldHelpMock = this.mock(FieldHelp);
		oFieldHelpMock.expects("_requestText2IdByType")
			.withExactArgs(sinon.match.same(oMetaModelInterface))
			.resolves(mText2IdByType);
		for (const [sPrefix, sType] of mPrefix2Type) {
			oInterfaceMock.expects("getTypeQName").withExactArgs(sPrefix).returns(sType);
		}

		// code under test
		const sResultPath = await FieldHelp._requestIDPropertyPath(oMetaModelInterface, sPath);

		assert.strictEqual(sResultPath, sIDPath, "correct ID path");
	});
});
});