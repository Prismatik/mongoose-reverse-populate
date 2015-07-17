
var _ = require("underscore");
var MANDATORY_FIELDS = ["modelArray", "storeWhere", "arrayPop", "mongooseModel", "idField"];

//modelArray - the array of 'models to populate' (authors)
//storeWhere - where should the 'related models' be stored (which property i.e. "posts") within the 'models to populate' (those in the modelArray).
//arrayPop - if the 'model to populate' has many 'related models' this should be set to true. This ensures the results of the reverse populate are stored as an array (e.g. an Author has many Posts). If the 'model to populate' can only have one 'related model' this should be set to false (e.g. a User has one Address).
//mongooseModel - the mongoose model object to use to find the 'related model' e.g. Post
//idField - the property of the 'related model' that contains the _id of the 'model to populate' e.g. "author"
//filters - if you do not wish to limit which 'related models' are searched for (via .find) and then populated (i.e. inactive / disabled models)
//cb - the callback function that will receive the results once db query complets and models have been populated

function populateRelated(opts, cb) {

	// Check all mandatory fields have been provided
	MANDATORY_FIELDS.forEach(function(fieldName) {
		var type = typeof opts[fieldName];
		if (type === "undefined" || type === "null")
			throw new Error("Missing mandatory field " + fieldName);
	});

	// If empty array passed, exit!
	if (!opts.modelArray.length) return cb(null, opts.modelArray);

	// Transform the model array for easy lookups
	var modelIndex = _.indexBy(opts.modelArray, "_id");

	var popResult = populateResult.bind(this, opts.storeWhere, opts.arrayPop)

	// Find the ids of models within the opts.modelArray
	var ids = opts.modelArray.map(function(model) { return model._id });

	// Search for all models that match the above ids
	var query = opts.filters || {}

	// Create query object
	query[opts.idField] = { $in: ids };

	// Set query select() parameter or if it's null, return empty string
	var select = opts.select || '';

	// Set query populate() parameter or if it's null, return empty string
	var populate = opts.populate || '';

	// Set query limit() parameter or if it's null, return empty string
	var limit = opts.limit || '';

	// Set query sort() parameter or if it's null, return empty string
	var sort = opts.sort || '';

	// Do the query
	opts.mongooseModel
		.find(query)
		.select(select)
		.populate(populate)
		.limit(limit)
  	.sort(sort)
		.exec(function(err, results) {

			// If there is an error, callback with error
			if (err)
				return cb(err)

			// Map over results (models to be populated)
			results.forEach(function(result) {

				// Check if the ID field is an array
				var isArray = !isNaN(result[opts.idField].length);

				// If the idField is an array, map through this
				if (isArray) {
					result[opts.idField].map(function(resultId) {
						var match = modelIndex[resultId];
						// If match found, populate the result inside the match
						if (match) popResult(match, result)
					});

				// Id field is not an array
				} else {
					// So just add the result to the model
					var matchId = result[opts.idField]
					var match = modelIndex[matchId]

					// If match found, populate the result inside the match
					if (match) popResult(match, result)
				}
			});

		// Callback with passed modelArray
		cb(null, opts.modelArray)
	});
}

// Yo populate the result against the match
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

module.exports = populateRelated;
