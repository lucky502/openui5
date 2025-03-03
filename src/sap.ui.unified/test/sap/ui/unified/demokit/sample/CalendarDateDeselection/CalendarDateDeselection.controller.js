sap.ui.define([
		'sap/base/i18n/date/CalendarType',
		'sap/ui/core/mvc/Controller',
		'sap/ui/core/format/DateFormat',
		'sap/ui/core/date/UI5Date'
	], function(CalendarType, Controller, DateFormat, UI5Date) {
	"use strict";

	return Controller.extend("sap.ui.unified.sample.CalendarDateDeselection.CalendarDateDeselection", {
		oFormatYyyymmdd: null,

		onInit: function() {
			this.oFormatYyyymmdd = DateFormat.getInstance({pattern: "yyyy-MM-dd", calendarType: CalendarType.Gregorian});
			this.getView().byId("calendar").displayDate(UI5Date.getInstance(2021, 6, 1));
		},

		handleCalendarSelect: function(oEvent) {
			var oCalendar = oEvent.getSource(),
				oSelectedDate = oCalendar.getSelectedDates()[0],
				oStartDate = oSelectedDate.getStartDate();
			if (this.oLastSelectedJSDate && oStartDate.getTime() === this.oLastSelectedJSDate.getTime()) {
				oCalendar.removeSelectedDate(oSelectedDate);
				this.oLastSelectedJSDate = null;
			} else {
				this.oLastSelectedJSDate = oStartDate;
			}
			this._updateText(oCalendar);
		},

		_updateText: function(oCalendar) {
			var oText = this.byId("selectedDate"),
				aSelectedDates = oCalendar.getSelectedDates(),
				oDate;
			if (aSelectedDates.length > 0 ) {
				oDate = aSelectedDates[0].getStartDate();
				oText.setText(this.oFormatYyyymmdd.format(oDate));
			} else {
				oText.setText("No Date Selected");
			}
		}
	});

});