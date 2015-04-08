var _ = require("lodash");

//modelArray - the array of 'models to populate' (authors)
//storeWhere - where should the 'related models' be stored (which property i.e. "posts") within the 'models to populate' (those in the modelArray).
//arrayPop - if the 'model to populate' has many 'related models' this should be set to true. This ensures the results of the reverse populate are stored as an array (e.g. an Author has many Posts). If the 'model to populate' can only have one 'related model' this should be set to false (e.g. a User has one Address).
//mongooseModel - the mongoose model object to use to find the 'related model' e.g. Post
//idField - the property of the 'related model' that contains the _id of the 'model to populate' e.g. "author"
//cb - the callback function that will receive the results once db query complets and models have been populated
var populateRelated = function(modelArray, storeWhere, arrayPop, mongooseModel, idField, cb) {

	//if empty array passed, exit!
	if (!modelArray.length) return cb(null, modelArray);

	//transform the model array for easy lookups
	var modelIndex = _.indexBy(modelArray, "_id");

	var popResult = populateResult.bind(this, storeWhere, arrayPop)

	//find the ids of models within the modelArray
	var ids = modelArray.map(function(model) { return model._id });

	//search for all models that match the above ids
	var opts = {}
	opts[idField] = {$in: ids}
	mongooseModel.find(opts).exec(function(err, results) {
		if (err) return cb(err)

		//map over results (models to be populated)
		results.forEach(function(result) {
			//check if the ID field is an array
			var isArray = !isNaN(result[idField].length)
			//if the idField is an array, map through this
			if (isArray) {
				result[idField].map(function(resultId) {
					var match = modelIndex[resultId];
					//if match found, populate the result inside the match
					if (match) popResult(match, result)
				})
			//id field is not an array
			} else {
				//so just add the result to the model
				var matchId = result[idField]
				var match = modelIndex[matchId]
				//if match found, populate the result inside the match
				if (match) popResult(match, result)
			}
		});

		//return the modelArray
		cb(null, modelArray)
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
