/**
 * Copyright (c) 2022 Oracle and/or its affiliates. All rights reserved.
 */

/* global SCS, SCSRenderAPI */
/* globals define */
define([
	'knockout',
	'jquery',
	'text!./template.html',
	'css!./css/styles.css'
], function (ko, $, template, css) {
	'use strict';

	// --------------------
	// Component ViewModel
	// --------------------
	var ComponentViewModel = function () {
		var self = this;

		// component observables
		self.menuItems = ko.observableArray([]);

		self.createMenuItem = function (parent, pageId) {
			var menuItem = SCS.structureMap[pageId];
			menuItem.destination = ko.observable(menuItem.linkUrl);
			if (menuItem.destination() === "") {
				var linkData = SCSRenderAPI.getPageLinkData(menuItem.id) || {};
				menuItem.destination(linkData.href ? linkData.href : "");
			}
			menuItem.parent = ko.observable(self === parent ? undefined : parent);
			menuItem.menuItems = ko.observableArray([]);
			menuItem.isActive = ko.observable(false);

			return menuItem;
		};

		self.setMenuItemActive = function (menuItem) {
			menuItem.isActive(true);
			if (menuItem.parent() !== undefined) {
				self.setMenuItemActive(menuItem.parent());
			}
		};

		self.buildMenuItemStructure = function (parent, pageId) {
			var menuItem = self.createMenuItem(parent, pageId);
			if (!menuItem.hideInNavigation || menuItem.id === SCS.navigationRoot) {
				if (!menuItem.hideInNavigation) {
					parent.menuItems.push(menuItem);

					// If this is the current page then set it to active (along with its parents)
					if (menuItem.id === SCS.navigationCurr) {
						self.setMenuItemActive(menuItem);
					}

					// Home menu is special so that we can keep in line with its children
					if (menuItem.id !== SCS.navigationRoot) {
						parent = menuItem;
					}
				}

				// Now build the children menu items if there are any
				for (var i = 0; i < menuItem.children.length; i++) {
					self.buildMenuItemStructure(parent, menuItem.children[i]);
				}
			}
		};

		self.buildMenuItemStructure(self, SCS.navigationRoot);

		self.toggleMenu = function () {
			$(".CSI-NavMenu").toggleClass("active");
		};

		$(document).ready(function () {
			$(document).on('keyup click', function (e) {
				var keycode = (e.keyCode ? e.keyCode : e.which);
				if (keycode === 27) {
					$(".CSI-NavMenu").removeClass("active");
				} else if ($(e.target).closest(".CSI-NavMenu").length === 0) {
					$(".CSI-NavMenu").removeClass("active");
				}
			});
		});
	};

	// ----------------------------------------------
	// Create a knockout-based component implemention
	// ----------------------------------------------
	var ComponentImpl = function (args) {
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

			// Programatically indent the subMenu items
			var leftPadding = 0;
			var subMenuElementName = ".CSI-NavMenu .subMenu";
			var $subMenu = $(subMenuElementName);
			while ($subMenu[0] !== undefined) {
				$subMenu.find("li a div").css("padding-left", leftPadding + "px");

				leftPadding += 20;
				subMenuElementName += " .subMenu";
				$subMenu = $(subMenuElementName);
			}
		}, this);
	};

	// ----------------------------------------------
	// Create the factory object for the component
	// ----------------------------------------------
	var componentFactory = {
		createComponent: function (args, callback) {
			// return a new instance of the component
			return callback(new ComponentImpl(args));
		}
	};

	return componentFactory;
});