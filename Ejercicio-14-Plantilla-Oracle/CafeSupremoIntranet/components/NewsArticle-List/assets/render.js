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
		contentVersion: ">=1.0.0 <2.0.0",

		render: function (parentObj) {
			var content = $.extend({}, this.contentItemData),
				contentClient = this.contentClient;

			content = $.extend(content, {
				'scsData': this.scsData
			});

			try {
				content.formattedDate = dateToMDY(content.fields.newsarticle_date);

				content.imageURL = contentClient.getRenditionURL({
					'itemGUID': content.fields.newsarticle_image.id
				});

				// Mustache
				var template = Mustache.render(templateHtml, content);
				$(parentObj).append(template);

				// Hover/Focus: Automatically set the background color of the image based off of the first pixel in the image
				$(".newsArticle-list #" + content.id + "-image").on("load", function () {
					var imageCanvas = document.createElement('canvas');
					var imageCanvasContext = imageCanvas.getContext("2d");
					imageCanvasContext.drawImage(this, 0, 0);
					var imageData = imageCanvasContext.getImageData(0, 0, 1, 1);

					$("#" + content.id + "-content").hover(function () {
						$(this).css("background-color", "rgba(" + imageData.data[0] + "," + imageData.data[1] + "," + imageData.data[2] + ",.8)");
					}, function () {
						$(this).css("background-color", "rgba(0,0,0,0)");
					});

					parentObj.addEventListener("focus", function () {
						$(parentObj).find(".contentItem").css("background-color", "rgba(" + imageData.data[0] + "," + imageData.data[1] + "," + imageData.data[2] + ",.8)");
					}, true);
					parentObj.addEventListener("blur", function () {
						$(parentObj).find(".contentItem").css("background-color", "rgba(0,0,0,0)");
					}, true);
				});

			} catch (e) {
				console.error(e.stack);
			}
		}
	};

	function dateToMDY(date) {
		var dateObj = new Date(date.value);

		var options = { year: 'numeric', month: 'long', day: 'numeric' };
		var formattedDate = dateObj.toLocaleDateString('en-US', options);

		return formattedDate;
	}

	return ContentLayout;
});