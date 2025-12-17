/**
 * Copyright (c) 2022 Oracle and/or its affiliates. All rights reserved.
 */

/* globals define */
define(['knockout',
	'jquery',
	'text!./template.html',
	'css!./css/current-user-avatar.css'
], function (ko, $, template, css) {
	'use strict';
	// ----------------------------------------------
	// Define a Knockout ViewModel for your template
	// ----------------------------------------------
	var ComponentViewModel = function (args) {
		var self = this;

		// store the args
		self.mode = args.viewMode;
		self.id = args.id;

		// create the observables		
		self.person = ko.observable();
		self.userAvatarURL = ko.observable();
		self.logoutUrl = ko.observable("/cloudgate/logout.html?postlogouturl=" + SCS.sitePrefix);
		// Need the time stamp to make sure this avatar image is not cached
		self.userAvatarURL('/documents/web/?IdcService=GET_USER_AVATAR&ts=' + new Date().getTime());

		//toggle drop down menu
		self.toggleDropdownMenu = function () {
			// Shift focus to Dropdown menu
			$(".currentUserAvatar #dropdown").toggleClass("hide");
			if (!$('.currentUserAvatar #dropdown').hasClass("hide")) {
				setTimeout(() => {
					$(".currentUserAvatar #dropdown a")[0].focus();
				}, 0);
			}
		};
		self.dropDownBlur = function () {
			$(".currentUserAvatar #dropdown").addClass("hide");
		}		

		// Get the current user information
		$.ajax({
			url: '/documents/web/?IdcService=GET_SERVER_INFO',
			success: function (data) {
				self.person(data.LocalData.dUserFullName);
			},
			error: function () {
				console.error("Can't get user information.");
			}
		});
	};

	// ----------------------------------------------
	// Create a knockout based component implemention
	// ----------------------------------------------
	var ComponentImpl = function (args) {
		// Initialze the custom component
		this.init(args);
	};

	// initialize all the values within the component from the given argument values
	ComponentImpl.prototype.init = function (args) {
		this.createViewModel(args);
		this.createTemplate(args);
		this.setupCallbacks();
	};

	// create the viewModel from the initial values
	ComponentImpl.prototype.createViewModel = function (args) {
		// create the viewModel
		this.viewModel = new ComponentViewModel(args);
	};

	// create the template based on the initial values
	ComponentImpl.prototype.createTemplate = function (args) {
		// create a unique ID for the div to add, this will be passed to the callback
		this.contentId = args.id + '_content_' + args.mode;
		// create a hidden custom component template that can be added to the DOM
		this.template = '<div id="' + this.contentId + '">' +
			template +
			'</div>';
	};
	//
	// SDK Callbacks
	// setup the callbacks expected by the SDK API
	//
	ComponentImpl.prototype.setupCallbacks = function () {
		//
		// callback - render: add the component into the page
		//
		this.render = $.proxy(function (container) {
			var $container = $(container);
			$container.append(this.template);
			// apply the bindings
			ko.applyBindings(this.viewModel, $('#' + this.contentId)[0]);
		}, this);
	};

	// ----------------------------------------------
	// Create the factory object for your component
	// ----------------------------------------------
	var componentFactory = {
		createComponent: function (args, callback) {
			// return a new instance of the component
			return callback(new ComponentImpl(args));
		}
	};
	return componentFactory;
});