/**
 * Copyright (c) 2022 Oracle and/or its affiliates. All rights reserved.
 */

/* global RightNow */
define([
	'knockout',
	'jquery',
	'require'
], function (ko, $, require) {
	'use strict';

	// ----------------------------------------------
	// Define a binding handler to setup the rightnow component
	// ----------------------------------------------
	ko.bindingHandlers.setupRightNow = {
		update: function (element, valueAccessor, allBindings, viewModel, bindingContext) {
			var self = viewModel;

			// update the rightNow widget
			// NOTE: We have to do it this way because the RightNow div is loaded asyc and can cause
			//	multiple instances when a user is changing the settings properties of the component.
			var $displayDiv = $('#' + self.displayDiv);
			var $hiddenDiv = $('#' + self.hiddenDiv);

			// move the current RightNow div to the hidden div if it exists
			var $currentComponent = $('#' + self.rightNowDivId);
			if ($currentComponent.length > 0 && $hiddenDiv.length > 0) {
				$currentComponent.appendTo($hiddenDiv);
			}

			if ($displayDiv.length > 0 && $hiddenDiv.length > 0) {
				self.rightNowDivId = "RightNow-" + Math.round(Math.random() * 100000);
				$displayDiv.append('<div id="' + self.rightNowDivId + '"></div>');

				// insert the component into the new div
				var rightNowURL = 'https://' + self.rightNowSiteName() + '.widget.' + self.rightNowDomainName();
				self.displayRightNowWidget(rightNowURL, self.rightNowDivId, self.rightNowMaxResults());
			}
		}
	};

	// Knockout view model for the menu.
	// @param args
	// @constructor
	var ComponentViewModel = function (args) {
		var self = this;
		var SitesSDK = args.SitesSDK;

		// add in the div IDs
		self.displayDiv = 'displayDiv' + self.id;
		self.hiddenDiv = 'hiddenDiv' + self.id;
		self.rightNowDivId = 'noDivDefined';

		// Define observables for Knockout bindings
		self.initialized = ko.observable(false);
		// ViewModel properties
		var properties = [
			'rightNowDomainName',
			'rightNowSiteName',
			'rightNowMaxResults'
		];
		// Create observables for properties
		$.each(properties, function (i, propName) {
			self[propName] = ko.observable();
		});

		self.displayRightNowWidget = function (rightNowURL, rightNowDivId, rightNowMaxResults) {
			require([rightNowURL + '/euf/rightnow/RightNow.Client.js'], function () {
				RightNow.Client.Controller.addComponent(
					{
						div_id: rightNowDivId,
						number_answers: rightNowMaxResults,
						target: "_blank",
						instance_id: "skw_0",
						module: "KnowledgeSyndication",
						type: 3
					},
					rightNowURL + '/ci/ws/get');
				RightNow.Client.Event.evt_widgetLoaded.subscribe(function (eventName, args, scope) { });
			});
		};

		// Handle property changes
		self.updateCustomSettingsData = function (data) {
			// Update observable values
			$.each(properties, function (i, propName) {
				self[propName](data[propName]);
			});
			self.initialized(true);
		};
		// Get the current customSettingsData values
		SitesSDK.getProperty('customSettingsData', self.updateCustomSettingsData);
		//  Listen for changes to the settings data.
		SitesSDK.subscribe('SETTINGS_UPDATED', function (settings) {
			if (settings.property === 'customSettingsData') {
				self.updateCustomSettingsData(settings.value);
			}
		});
		// Listen for actions
		SitesSDK.subscribe(SitesSDK.MESSAGE_TYPES.EXECUTE_ACTION, $.proxy(self.executeActionListener, self));
	};

	// Return the view model
	return ComponentViewModel;
});