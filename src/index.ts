import { Model, QueryWithHelpers, FilterQuery } from "mongoose";

// Check all mandatory fields have been provided
function checkRequired<
  TopLevelDocument extends Record<string, unknown>,
  NestedDocument extends Record<string, unknown>,
  StoreWhere extends string
>(
  required: typeof REQUIRED_FIELDS,
  options: Options<TopLevelDocument, NestedDocument, StoreWhere>
): void {
  required.forEach((fieldName) => {
    if (options[fieldName] == null)
      throw new Error(`Missing mandatory field ${fieldName}`);
  });
}

// Build the query string with user provided options
function buildQuery<
  TopLevelDocument extends Record<string, unknown>,
  NestedDocument extends Record<string, unknown>,
  StoreWhere extends string
>(options: Options<TopLevelDocument, NestedDocument, StoreWhere>) {
  const ids = options.modelArray.map((model) => model._id);

  const conditions: FilterQuery<NestedDocument> = {
    ...(options.filters || {}),
    [options.idField]: {
      $in: ids,
    },
  };

  let query: QueryWithHelpers<NestedDocument[], NestedDocument> =
    options.mongooseModel.find<NestedDocument>(conditions);

  if (options.select) {
    const select = getSelectString(options.select, options.idField.toString());
    query.select(select);
  }

  if (options.populate) {
    query.populate(options.populate);
  }
  if (options.sort) {
    query.sort(options.sort);
  }
  return query;
}

// Ensure the select option always includes the required id field to populate the relationship
function getSelectString(selectStr: string, requiredId: string): string {
  const selected = selectStr.split(" ");
  const idIncluded = selected.includes(requiredId);
  if (!idIncluded) return selectStr + " " + requiredId;
  return selectStr;
}

function populateResult<
  TopLevelDocument extends Record<string, unknown>,
  NestedDocument extends Record<string, unknown>
>(
  storeWhere: string,
  arrayPop: boolean,
  match: TopLevelDocument,
  result: NestedDocument
): void {
  if (arrayPop) {
    if (typeof match[storeWhere] === "undefined") {
      // @ts-expect-error TypeScript doesn't like dynamic property access
      match[storeWhere] = [];
    }

    // @ts-expect-error TypeScript doesn't like dynamic property access
    match[storeWhere].push(result);
  } else {
    // @ts-expect-error TypeScript doesn't like dynamic property access
    match[storeWhere] = result;
  }
}

function createPopulateResult<
  TopLevelDocument extends Record<string, unknown>,
  NestedDocument extends Record<string, unknown>
>(
  storeWhere: string,
  arrayPop: boolean
): (match: TopLevelDocument, result: NestedDocument) => void {
  // Return a function that only requires the remaining two parameters
  return function (match, result) {
    populateResult(storeWhere, arrayPop, match, result);
  };
}

interface Options<
  TopLevelDocument extends Record<string, unknown>,
  NestedDocument extends Record<string, unknown>,
  StoreWhere extends string
> {
  modelArray: TopLevelDocument[];
  storeWhere: StoreWhere;
  arrayPop: boolean;
  mongooseModel: Model<NestedDocument>;
  idField: keyof NestedDocument;
  filters?: FilterQuery<NestedDocument>;
  sort?: string;
  populate?: {
    path: string;
    select?: string;
    populate?: {
      path: string;
      select: string;
    };
  }[];
  select?: string;
}

const REQUIRED_FIELDS = [
  "modelArray",
  "storeWhere",
  "arrayPop",
  "mongooseModel",
  "idField",
] as const;

export async function reversePopulate<
  TopLevelDocument extends Record<string, unknown>,
  NestedDocument extends Record<string, unknown>,
  StoreWhere extends string
>(
  options: Options<TopLevelDocument, NestedDocument, StoreWhere>
): Promise<
  | (TopLevelDocument & {
      [key in StoreWhere]: NestedDocument[];
    })[]
  | TopLevelDocument[]
> {
  // Check required fields have been provided
  checkRequired(REQUIRED_FIELDS, options);

  const { modelArray, storeWhere, arrayPop, idField } = options;

  // If empty array passed, exit!
  if (!modelArray.length) {
    return modelArray;
  }

  // Transform the model array for easy lookups
  let modelIndex: Record<string, TopLevelDocument> = {};
  modelArray.forEach((model) => {
    modelIndex = {
      ...modelIndex,
      [model._id as string]: model,
    };
  });

  const populateResult = createPopulateResult(storeWhere, arrayPop);

  const query = buildQuery(options);

  // Do the query
  const documents = await query.exec();

  // Map over results (models to be populated)
  documents.forEach((document) => {
    // Check if the ID field is an array
    const _id = document[idField];

    const isArray = Array.isArray(_id);

    // If _id is an array, map through this
    if (isArray) {
      _id.forEach((individualId) => {
        const match = modelIndex[individualId];
        // If match found, populate the result inside the match
        if (match) {
          populateResult(match, document);
        }
      });
    } else {
      // Id field is not an array
      // So just add the result to the model
      const match = modelIndex[_id as string];

      // If match found, populate the result inside the match
      if (match) {
        populateResult(match, document);
      }
    }
  });

  // Callback with passed modelArray
  return modelArray;
}
