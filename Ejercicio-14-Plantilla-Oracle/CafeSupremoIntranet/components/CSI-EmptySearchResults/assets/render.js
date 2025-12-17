/**
 * Copyright (c) 2022 Oracle and/or its affiliates. All rights reserved.
 */

/* globals define,console */
define([
	"jquery",
	"text!./layout.html",
	"css!./design.css"
], function ($, templateHtml, css) {
	"use strict";

	// Content Layout constructor function.
	function ContentLayout() {
	}

	// Content Layout definition.
	ContentLayout.prototype = {
		// Specify the versions of the Content REST API that are supported by the this Content Layout.
		// The value for contentVersion follows Semantic Versioning syntax.
		// This allows applications that use the content layout to pass the data through in the expected format.
		contentVersion: ">=1.0.0 <2.0.0",

		// Main rendering function:
		// - Appends the templateHtml to the parentObj DOM element
		render: function (parentObj) {
			$(parentObj).append(templateHtml);

			// This is a bit of a hack but the only way to hide the pagination information as it does not make sense when no items are returned
			$(parentObj).parent().find(".scs-pagination").hide();
		}
	};

	return ContentLayout;
});