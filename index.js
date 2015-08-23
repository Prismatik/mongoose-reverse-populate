var _ = require("lodash");
var REQUIRED_FIELDS = ["modelArray", "storeWhere", "arrayPop", "mongooseModel", "idField"];

function reversePopulate(opts, cb) {

	// Check required fields have been provided
	try { checkRequired(REQUIRED_FIELDS, opts); }
	catch (ex) { return cb(ex); }

	// If empty array passed, exit!
	if (!opts.modelArray.length) return cb(null, opts.modelArray);

	// Transform the model array for easy lookups
	var modelIndex = _.indexBy(opts.modelArray, "_id");

	var popResult = populateResult.bind(this, opts.storeWhere, opts.arrayPop);

	var query = buildQuery(opts);

	// Do the query
	query.exec(function(err, results) {
		// If there is an error, callback with error
		if (err) return cb(err);

		// Map over results (models to be populated)
		results.forEach(function(result) {

			// Check if the ID field is an array
			var isArray = !isNaN(result[opts.idField].length);

			// If the idField is an array, map through this
			if (isArray) {
				result[opts.idField].map(function(resultId) {
					var match = modelIndex[resultId];
					// If match found, populate the result inside the match
					if (match) popResult(match, result);
				});

			// Id field is not an array
			} else {
				// So just add the result to the model
				var matchId = result[opts.idField];
				var match = modelIndex[matchId];

				// If match found, populate the result inside the match
				if (match) popResult(match, result);
			}
		});

		// Callback with passed modelArray
		cb(null, opts.modelArray);
	});
}

module.exports = reversePopulate;

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
	if (opts.limit) query = query.limit(opts.limit);
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
		if (typeof match[storeWhere] === "undefined") match[storeWhere] = [];
		// Push the result into the array
		match[storeWhere].push(result);
	// This is a one to one relationship
	} else {
		// Save the results
		match[storeWhere] = result;
	}
}

