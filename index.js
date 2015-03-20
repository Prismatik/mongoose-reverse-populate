var _ = require("lodash");

//modelArray - the array of models that need to be populated
//storeWhere - where should the models be stored (the property) within the models in the modelArray
//arrayPop - if the relationship between the modelArray and model being added is 1 to many, this should be true ELSE false 
//mongooseModel - the mongoose model that contains the model that is to be added to the models in the model Arry
//idField - the field on the models to be added that contains the _id of the models in the modelArray
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
