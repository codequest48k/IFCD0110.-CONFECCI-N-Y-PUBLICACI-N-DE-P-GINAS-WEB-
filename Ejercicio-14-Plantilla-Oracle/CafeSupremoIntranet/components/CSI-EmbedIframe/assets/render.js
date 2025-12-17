/**
 * Copyright (c) 2022 Oracle and/or its affiliates. All rights reserved.
 */

/* globals define */
define([
	'knockout',
	'jquery',
	'css!./styles/design.css',
	'text!./template.html'
], function (ko, $, css, template) {
	'use strict';

	// ----------------------------------------------
	// Define a Knockout ViewModel for your template
	// ----------------------------------------------
	var SampleComponentViewModel = function (args) {
		var self = this,
			SitesSDK = args.SitesSDK;

		// store the args
		self.mode = args.viewMode;
		self.id = args.id;

		// create the observables
		self.renderUrl = ko.observable();
		self.iframeTitle = ko.observable();
		self.iframeHeight = ko.observable();

		// handle initialization 
		self.customSettingsDataInitialized = ko.observable(false);
		self.initialized = ko.computed(function () {
			return self.customSettingsDataInitialized();
		}, self);

		self.encodeURL = function (val) {
			// encode all special characters, except: , / ? : @ & = + $ 
			var origVal = val ? (typeof val === 'function' ? val().toString() : val.toString()) : '',
				encodeVal = encodeURI(origVal);
			encodeVal = encodeVal.replace(/javascript:/ig, 'java-script:');
			encodeVal = encodeVal.replace(/vbscript:/ig, 'vb-script:');
			return encodeVal;
		}

		self.updateCustomSettingsData = $.proxy(function (customData) {
			if (customData) {
				self.renderUrl(customData.renderUrl);
				self.iframeTitle(customData.iframeTitle);
				self.iframeHeight(customData.iframeHeight);
			}
			self.customSettingsDataInitialized(true);
		}, self);
		self.updateSettings = function (settings) {
			if (settings.property === 'customSettingsData') {
				self.updateCustomSettingsData(settings.value);
			}
		};

		// listen for the EXECUTE ACTION request to handle custom actions
		SitesSDK.subscribe(SitesSDK.MESSAGE_TYPES.EXECUTE_ACTION, $.proxy(self.executeActionsListener, self));
		// listen for settings update
		SitesSDK.subscribe(SitesSDK.MESSAGE_TYPES.SETTINGS_UPDATED, $.proxy(self.updateSettings, self));


		// Handle Copy Style (save customSettingsData to the clipboard)
		self.copyComponentCustomData = function () {
			return {
				renderUrl: this.renderUrl(),
				iframeTitle: this.iframeTitle(),
				iframeHeight: this.iframeHeight()
			};
		};

		// Handle Paste Style (apply customSettingsData from the clipboard)
		self.pasteComponentCustomData = function (data) {
			this.renderUrl(data.renderUrl);
			this.iframeTitle(data.iframeTitle);
			this.iframeHeight(data.iframeHeight);

			// save data in page
			SitesSDK.setProperty('customSettingsData', {
				renderUrl: this.renderUrl(),
				iframeTitle: this.iframeTitle(),
				iframeHeight: this.iframeHeight()
			});
		};

		// listen for COPY_CUSTOM_DATA request
		SitesSDK.subscribe(SitesSDK.MESSAGE_TYPES.COPY_CUSTOM_DATA, $.proxy(self.copyComponentCustomData, self));

		// listen for PASTE_CUSTOM_DATA request
		SitesSDK.subscribe(SitesSDK.MESSAGE_TYPES.PASTE_CUSTOM_DATA, $.proxy(self.pasteComponentCustomData, self));

		//
		// Initialize the customSettingsData values
		//
		SitesSDK.getProperty('customSettingsData', self.updateCustomSettingsData);
	};


	// ----------------------------------------------
	// Create a knockout based component implemention
	// ----------------------------------------------
	var SampleComponentImpl = function (args) {
		// Initialze the custom component
		this.init(args);
	};
	// initialize all the values within the component from the given argument values
	SampleComponentImpl.prototype.init = function (args) {
		this.createViewModel(args);
		this.createTemplate(args);
		this.setupCallbacks();
	};
	// create the viewModel from the initial values
	SampleComponentImpl.prototype.createViewModel = function (args) {
		// create the viewModel
		this.viewModel = new SampleComponentViewModel(args);
	};
	// create the template based on the initial values
	SampleComponentImpl.prototype.createTemplate = function (args) {
		// create a unique ID for the div to add, this will be passed to the callback
		this.contentId = args.id + '_content_' + args.viewMode;
		// create a hidden custom component template that can be added to the DOM
		this.template = '<div id="' + this.contentId + '">' +
			template +
			'</div>';
	};
	//
	// SDK Callbacks
	// setup the callbacks expected by the SDK API
	//
	SampleComponentImpl.prototype.setupCallbacks = function () {
		//
		// callback - render: add the component into the page
		//
		this.render = $.proxy(function (container) {
			var $container = $(container);
			// add the custom component template to the DOM
			$container.append(this.template);
			// apply the bindings
			ko.applyBindings(this.viewModel, $('#' + this.contentId)[0]);
		}, this);
		//
		// callback - update: handle property change event
		//
		this.update = $.proxy(function (args) {
			var self = this;
			// deal with each property changed
			$.each(args.properties, function (index, property) {
				if (property) {
					if (property.name === 'customSettingsData') {
						self.viewModel.updateComponentData(property.value);
					}
				}
			});
		}, this);
		//
		// callback - dispose: cleanup after component when it is removed from the page
		//
		this.dispose = $.proxy(function () {
			// nothing required for this sample since knockout disposal will automatically clean up the node
		}, this);
	};
	// ----------------------------------------------
	// Create the factory object for your component
	// ----------------------------------------------
	var sampleComponentFactory = {
		createComponent: function (args, callback) {
			// return a new instance of the component
			return callback(new SampleComponentImpl(args));
		}
	};
	return sampleComponentFactory;
});