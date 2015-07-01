var _ = require("lodash");
var MANDATORY_FIELDS = ["modelArray", "storeWhere", "arrayPop", "mongooseModel", "idField"];

//modelArray - the array of 'models to populate' (authors)
//storeWhere - where should the 'related models' be stored (which property i.e. "posts") within the 'models to populate' (those in the modelArray).
//arrayPop - if the 'model to populate' has many 'related models' this should be set to true. This ensures the results of the reverse populate are stored as an array (e.g. an Author has many Posts). If the 'model to populate' can only have one 'related model' this should be set to false (e.g. a User has one Address).
//mongooseModel - the mongoose model object to use to find the 'related model' e.g. Post
//idField - the property of the 'related model' that contains the _id of the 'model to populate' e.g. "author"
//filters - if you do not wish to limit which 'related models' are searched for (via .find) and then populated (i.e. inactive / disabled models)
//cb - the callback function that will receive the results once db query complets and models have been populated
var populateRelated = function(opts, cb) {

	//check all mandatory fields have been provided
	MANDATORY_FIELDS.forEach(function(fieldName) {
		var type = typeof opts[fieldName];
		if (type === "undefined" || type === "null") 
			throw new Error("Missing mandatory field " + fieldName);
	})

	//if empty array passed, exit!
	if (!opts.modelArray.length) return cb(null, opts.modelArray);

	//transform the model array for easy lookups
	var modelIndex = _.indexBy(opts.modelArray, "_id");

	var popResult = populateResult.bind(this, opts.storeWhere, opts.arrayPop)

	//find the ids of models within the opts.modelArray
	var ids = opts.modelArray.map(function(model) { return model._id });

	//search for all models that match the above ids
	var query = {}
	query[opts.idField] = {$in: ids}
	opts.mongooseModel.find(query).exec(function(err, results) {
		if (err) return cb(err)

		//map over results (models to be populated)
		results.forEach(function(result) {
			//check if the ID field is an array
			var isArray = !isNaN(result[opts.idField].length)
			//if the idField is an array, map through this
			if (isArray) {
				result[opts.idField].map(function(resultId) {
					var match = modelIndex[resultId];
					//if match found, populate the result inside the match
					if (match) popResult(match, result)
				})
			//id field is not an array
			} else {
				//so just add the result to the model
				var matchId = result[opts.idField]
				var match = modelIndex[matchId]
				//if match found, populate the result inside the match
				if (match) popResult(match, result)
			}
		});

		//return the modelArray
		cb(null, opts.modelArray)
	})
}

//to populate the result against the match
var populateResult = function(storeWhere, arrayPop, match, result) {
	//if this is a one to many relationship
	if (arrayPop) {
		//check if array exists, if not create one
		if (typeof match[storeWhere] === "undefined") match[storeWhere] = []
		//push the result into the array
		match[storeWhere].push(result)
	//this is a one to one relationship
	} else {
		//save the results
		match[storeWhere] = result
	}
}

module.exports = populateRelated
