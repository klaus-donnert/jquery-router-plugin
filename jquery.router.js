/*
    plugin name: router
    jquery plugin to handle routes with both hash and push state
    why? why another routing plugin? because i couldnt find one that handles both hash and pushstate
    created by 24hr // camilo.tapia
    author twitter: camilo.tapia
  
    Copyright 2011  camilo tapia // 24hr (email : camilo.tapia@gmail.com)

    This program is free software; you can redistribute it and/or modify
    it under the terms of the GNU General Public License, version 2, as 
    published by the Free Software Foundation.

    This program is distributed in the hope that it will be useful,
    but WITHOUT ANY WARRANTY; without even the implied warranty of
    MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
    GNU General Public License for more details.

    You should have received a copy of the GNU General Public License
    along with this program; if not, write to the Free Software
    Foundation, Inc., 51 Franklin St, Fifth Floor, Boston, MA  02110-1301  USA
 */
/* jshint bitwise: true, curly: true, eqeqeq: true, forin: true, freeze: true, latedef: true,
 maxerr: 1000, noarg: true, undef:true, unused: true, browser: true, jquery: true, laxcomma: true */

(function($) {
	var hasPushState = (history && history.pushState);
	var hasHashState = !hasPushState && ("onhashchange" in window) && false;
	var router = {};
	var routeList = [];
	var eventAdded = false;
	var currentUsedUrl = location.href; // used for ie to hold the current url

	// hold the latest route that was activated
	router.currentId = "";
	router.currentParameters = {};

	router.capabilities = {
		hash: hasHashState,
		pushState: hasPushState,
		timer: !hasHashState && !hasPushState
	};

	// reset all routes
	router.reset = function() {
		routeList = [];
		router.currentId = "";
		router.currentParameters = {};
	};

	function RegexRoute(route) {
		this.regex = route;
	}

	RegexRoute.prototype.match = function(url) {
		var match = url.match(this.regex);
		if (match) {
			return {
				matches: match
			};
		}
		return false;
	};

	function StringRoute(route) {
		var spec = route;
		// remove the last slash to unify all routes
		if ('/' === spec.charAt(spec.length - 1)) {
			spec = spec.substring(0, spec.length - 1);
		}

		// if the routes where created with an absolute url, we have to remove the absolute part anyway, since we can't change that much
		spec = spec.replace(location.protocol + "//", "").replace(location.hostname, "");
		this.parts = spec.split('/').map(function(value) {
			if (':' === value.charAt(0)) {
				return {
					parameter: true,
					str: value.substring(1)
				};
			}
			return {
				parameter: false,
				str: value
			};
		});
	}

	StringRoute.prototype.match = function(url) {
		var currentUrlParts, matches = false, data = {};
		currentUrlParts = url.split("/");

		// first check so that they have the same amount of elements at least
		if (this.parts.length === currentUrlParts.length) {
			matches = this.parts.every(function(part, i) {
				if (part.parameter) {
					data[part.str] = decodeURI(currentUrlParts[i]);
				}
				else if (currentUrlParts[i] !== part.str) {
					return false;
				}
				return true;
			});
		}
		return matches ? data : false;
	};

	router.add = function(route, id, callback) {
		var routeItem;
		// if we only get a route and a callback, we switch the arguments
		if (typeof id === "function") {
			callback = id;
			id = null;
		}

		if (typeof route === "object") {
			routeItem = new RegexRoute(route);
		}
		else {
			routeItem = new StringRoute(route);
		}

		routeItem.id = id;
		routeItem.callback = callback;
		routeList.push(routeItem);

		// we add the event listener after the first route is added so that we dont need to listen to events in vain
		if (!eventAdded) {
			bindStateEvents();
		}
	};

	function bindStateEvents() {
		var url;
		eventAdded = true;

		// default value telling router that we havent replaced the url from a hash. yet.
		router.fromHash = false;

		if (hasPushState) {
			// if we get a request with a qualified hash (ie it begins with #!)
			if (location.hash.indexOf("#!/") === 0) {
				// replace the state
				url = location.pathname + location.hash.replace(/^#!\//gi, "");
				history.replaceState({}, "", url);

				// this flag tells router that the url was converted from hash to popstate
				router.fromHash = true;
			}

			$(window).bind("popstate", handleRoutes);
		}
		else if (hasHashState) {
			$(window).bind("hashchange.router", handleRoutes);
		}
		else {
			// if no events are available we use a timer to check periodically for changes in the url
			setInterval(function() {
				if (location.href !== currentUsedUrl) {
					handleRoutes();
					currentUsedUrl = location.href;
				}
			}, 500);
		}
	}

	bindStateEvents();

	router.go = function(url, title) {
		var hash;
		if (hasPushState) {
			history.pushState({}, title, url);
			checkRoutes();
		}
		else {
			// remove part of url that we don't use
			hash = url.replace(location.protocol + "//", "").replace(location.hostname, "").replace(location.pathname, "");

			if (hash.indexOf("!") < 0) {
				hash = "!/" + hash;
			}
			location.hash = hash;
		}
	};

	// do a check without affecting the history
	router.check = router.redo = function() {
		checkRoutes();
	};

	// parse and wash the url to process
	function parseUrl(url) {
		var currentUrl = url || location.pathname;

		currentUrl = decodeURI(currentUrl);

		// if no pushstate is availabe we have to use the hash
		if (!hasPushState) {
			if (location.hash.indexOf("#!/") === 0) {
				currentUrl += location.hash.substring(3);
			}
			else {
				return '';
			}
		}

		// and if the last character is a slash, we just remove it
		currentUrl = currentUrl.replace(/\/$/, "");

		return currentUrl;
	}

	function matchRoute(url) {
		var match = false;
		routeList.every(function(route) {
			var data = route.match(url);
			if (data) {
				match = {
					route: route,
					data: data
				};
				// break after first hit
				return false;
			}
			return true;
		});
		return match;
	}

	function checkRoutes() {
		var currentUrl = parseUrl()
			, match = matchRoute(currentUrl);

		if (match) {
			router.currentId = match.route.id;
			router.currentParameters = match.data;
			match.route.callback(router.currentParameters);
		}
	}

	function handleRoutes(e) {
		if (e && e.originalEvent && e.originalEvent.state !== undefined) {
			checkRoutes();
		}
		else if (hasHashState) {
			checkRoutes();
		}
		else if (!hasHashState && !hasPushState) {
			checkRoutes();
		}
	}

	$.router = router;
})(jQuery);
