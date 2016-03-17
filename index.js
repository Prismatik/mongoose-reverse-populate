var _ = require('lodash');
var REQUIRED_FIELDS = ["modelArray", "storeWhere", "arrayPop", "mongooseModel", "idField"];

function reversePopulate(opts, cb) {

	// Check required fields have been provided
	try { checkRequired(REQUIRED_FIELDS, opts); }
	catch (ex) { return cb(ex); }

	// If empty array passed, exit!
	if (!opts.modelArray.length) return cb(null, opts.modelArray);

	var popResult = populateResult.bind(this, opts.storeWhere, opts.arrayPop);

	var query = buildQuery(opts);

	// Do the query
	query.exec(function(err, results) {
		// If there is an error, callback with error
		if (err) return cb(err);

		// Map over results (models to be populated)
		results.forEach(function(result) {

			// Check if the ID field is an array
			var isArray = !isNaN(getDeep(result, opts.idField).length);

			// If the idField is an array, map through this
			if (isArray) {
				getDeep(result, opts.idField).map(function(resultId) {
					var match = getElementById(opts.modelArray, resultId);

					// If match found, populate the result inside the match
					if (match) setElementById(opts.modelArray, resultId, popResult(getElementById(opts.modelArray, resultId), result));
				});

				// Id field is not an array
			} else {
				// So just add the result to the model
				var matchId = getDeep(result, opts.idField);
				var match = getElementById(opts.modelArray, matchId);

				// If match found, populate the result inside the match
				if (match) setElementById(opts.modelArray, matchId, popResult(getElementById(opts.modelArray, matchId), result));
			}
		});

		// Callback with passed modelArray
		cb(null, opts.modelArray);
	});
}

/**
 * Overlay of reversePopulate which embedded the specified field in the resulting objects' array.
 * Useful if the result is returned as JSON, as the populated field won't be exported otherwise.
 */
function reversePopulateForJson(opts, callback) {
	reversePopulate(opts, function(err, population) {
		if (err) callback(err);

		var res = addPopulatedFieldToResults(population, opts.storeWhere);
		callback(null, res);
	});
}

module.exports.reservePopulate = reversePopulate;
module.exports.reversePopulateForJson = reversePopulateForJson;


function addPopulatedFieldToResults(results, fields) {
	var res = [];
	results.forEach(function(r) {

		var pop = getDeep(r, fields);
		if (pop) {
			var popObj = {};
			setDeep(popObj, fields, pop);

			res.push(
				Object.assign(
					{},
					r.toObject(),
					popObj
				)
			);
		}
		else {
			res.push(r);
		}

	});
	return res;
}

/**
 * Set the provided value at the given path inside object
 * @param object {Object} eg: {{properties:{a: null, b: 4}}, constant: 'hello'}
 * @param indicator {string|Array} eg: 'properties.a' or ['properties', 'a'].
 * @param value {*} the new value to set to the given path
 */
function setDeep(object, indicator, value) {
	if (typeof indicator === 'string') {
		indicator = indicator.split('.');
	}

	if (indicator.length === 1) {
		object[indicator[0]] = value;
	} else {
		if (typeof object[indicator[0]] === 'undefined') {
			object[indicator[0]] = {};
		}
		setDeep(object[indicator[0]], indicator.slice(1), value);
	}
}

/**
 * Get the value at the given path inside object, preserving the object reference
 * @param object {Object} eg: {{properties:{a: null, b: 4}}, constant: 'hello'}
 * @param indicator {string|Array} eg: 'properties.a'. All path levels (except the deepest) MUST exist
 * @return {*} a reference to the requested value (if the requested value is an object)
 */
function getDeep(object, indicator) {
	if (typeof indicator === 'string') {
		indicator = indicator.split('.');
	}

	if (indicator.length === 1) {
		return object[indicator[0]];
	} else {
		if (typeof object[indicator[0]] === 'undefined') {
			return undefined;
		}
		else return getDeep(object[indicator[0]], indicator.slice(1));
	}
}

/**
 * Iterate through the provided array of elements and return the one with the corresponding '_id'
 * @param elements {Array<Object>}
 * @param id {*} value to look for inside the array's objects._id
 * @return {Object} or null if not found
 */
function getElementById(elements, id) {

	for (var i = 0; i < elements.length; i++) {
		if (elements[i] && String(elements[i]._id) == String(id)) {
			return elements[i];
		}
	}

	return null;
}

function setElementById(elements, id, value) {

	for (var i = 0; i < elements.length; i++) {
		if (elements[i] && String(elements[i]._id) == String(id)) {Object.assign(elements[i], value);}
	}

}

// Check all mandatory fields have been provided
function checkRequired(required, opts) {
	var msg = "Missing mandatory field ";
	required.forEach(function(fieldName) {
		if (opts[fieldName] == null) throw new Error(msg + fieldName);
	});
}

// Build the query string with user provided options
function buildQuery(opts) {
	var conditions = opts.filters || {};
	var ids = _.pluck(opts.modelArray, "_id");
	conditions[opts.idField] = { $in: ids };

	var query = opts.mongooseModel.find(conditions);

	// Set query select() parameter
	if (opts.select) {
		var select = getSelectString(opts.select, opts.idField);
		query = query.select(select);
	}

	if (opts.populate) query = query.populate(opts.populate);
	if (opts.sort) query = query.sort(opts.sort);
	return query;
}

// Ensure the select option always includes the required id field to populate the relationship
function getSelectString(selectStr, requiredId) {
	var selected = selectStr.split(" ");
	var idIncluded = !!~selected.indexOf(requiredId);
	if (!idIncluded) return selectStr + " " + requiredId;
	return selectStr;
}

// Populate the result against the match
function populateResult(storeWhere, arrayPop, match, result) {
	// If this is a one to many relationship
	if (arrayPop) {
		// Check if array exists, if not create one
		if (typeof getDeep(match, storeWhere) === "undefined") setDeep(match,storeWhere, []);
		// Push the result into the array
		getDeep(match,storeWhere).push(result);
		// This is a one to one relationship
	} else {
		// Save the results
		setDeep(match,storeWhere, result);
	}
}