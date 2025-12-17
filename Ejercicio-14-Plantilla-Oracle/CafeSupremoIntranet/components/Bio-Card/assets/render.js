/**
 * Copyright (c) 2022 Oracle and/or its affiliates. All rights reserved.
 */

/* globals define */

define([
	'jquery',
	'mustache',
	'text!./layout.html',
	'css!./design.css'
], function ($, Mustache, templateHtml, css) {
	'use strict';

	function ContentLayout(params) {
		this.contentItemData = params.contentItemData || {};
		this.scsData = params.scsData;
		this.contentClient = params.contentClient;
	}

	ContentLayout.prototype = {
		// Specify the versions of the Content REST API that are supported by the this Content Layout.
		// The value for contentVersion follows Semantic Versioning syntax.
		// This allows applications that use the content layout to pass the data through in the expected format.
		contentVersion: ">=1.1.0 <2.0.0",

		render: function (parentObj) {
			var content = $.extend({}, this.contentItemData),
				contentClient = this.contentClient;

			content = $.extend(content, {
				'scsData': this.scsData
			});

			this.getComponentURL(content);

			// Additional work required for the fields specific to this content type
			var fields = content.fields;

			// Get bio image
			fields.bio_image.url = contentClient.getRenditionURL({
				'id': fields.bio_image.id
			});

			try {
				// I Mustache you to bind this
				var template = Mustache.render(templateHtml, content);
				$(parentObj).append(template);
			} catch (err) {
				console.error("Couldn't render content:", err);
			}
		},

		getComponentURL: function (content) {
			this.scsData.SitesSDK.getProperty('assetsURL', $.proxy(function (assetsURL) {
				content.assetsURL = assetsURL.replace("scsCaaSLayout", "Bio-Card");
			}, this));
		}
	};

	return ContentLayout;
});