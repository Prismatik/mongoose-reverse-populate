const _ = require("lodash");

const REQUIRED_FIELDS = [
  "modelArray",
  "storeWhere",
  "arrayPop",
  "mongooseModel",
  "idField",
];

async function reversePopulate(opts, cb) {
  // Check required fields have been provided
  try {
    checkRequired(REQUIRED_FIELDS, opts);
  } catch (ex) {
    return cb(ex);
  }

  // If empty array passed, exit!
  if (!opts.modelArray.length) return cb(null, opts.modelArray);

  // Transform the model array for easy lookups
  const modelIndex = _.indexBy(opts.modelArray, "_id");

  const popResult = populateResult.bind(this, opts.storeWhere, opts.arrayPop);

  const query = buildQuery(opts);

  // Do the query
  try {
    const results = await query.exec();

    // Map over results (models to be populated)
    results.forEach((result) => {
      // Check if the ID field is an array
      const isArray = Array.isArray(result[opts.idField]);

      // If the idField is an array, map through this
      if (isArray) {
        result[opts.idField].forEach((resultId) => {
          const match = modelIndex[resultId];
          // If match found, populate the result inside the match
          if (match) popResult(match, result);
        });

        // Id field is not an array
      } else {
        // So just add the result to the model
        const matchId = result[opts.idField];
        const match = modelIndex[matchId];

        // If match found, populate the result inside the match
        if (match) popResult(match, result);
      }
    });

    // Callback with passed modelArray
    cb(null, opts.modelArray);
  } catch (err) {
    cb(err);
  }
}

module.exports = reversePopulate;

// Check all mandatory fields have been provided
function checkRequired(required, opts) {
  const msg = "Missing mandatory field ";
  required.forEach((fieldName) => {
    if (opts[fieldName] == null) throw new Error(msg + fieldName);
  });
}

// Build the query string with user provided options
function buildQuery(opts) {
  const conditions = opts.filters || {};
  const ids = _.pluck(opts.modelArray, "_id");
  conditions[opts.idField] = { $in: ids };

  let query = opts.mongooseModel.find(conditions);

  // Set query select() parameter
  if (opts.select) {
    const select = getSelectString(opts.select, opts.idField);
    query = query.select(select);
  }

  if (opts.populate) query = query.populate(opts.populate);
  if (opts.sort) query = query.sort(opts.sort);
  return query;
}

// Ensure the select option always includes the required id field to populate the relationship
function getSelectString(selectStr, requiredId) {
  const selected = selectStr.split(" ");
  const idIncluded = selected.includes(requiredId);
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
