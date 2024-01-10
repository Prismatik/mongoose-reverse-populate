const reversePopulate = require("../index.js");

const assert = require("assert");
const _ = require("lodash");
const mongoose = require("mongoose");

mongoose.connect("mongodb://localhost/mongoose-reverse-populate-test");
const Schema = mongoose.Schema;

const rando = () => {
  return Math.floor(Math.random() * (1 << 24)).toString(16);
};

describe("reverse populate", () => {
  describe("multiple results", () => {
    let Category, Post, Author;
    let categories, posts, authors;

    //define schemas and models for tests
    before(async () => {
      //a category has many posts
      const categorySchema = new Schema({
        name: String,
      });
      Category = mongoose.model("Category", categorySchema);

      //a post can have many categories
      //a post can ONLY have one author
      const postSchema = new Schema({
        title: String,
        categories: [{ type: Schema.Types.ObjectId, ref: "Category" }],
        author: { type: Schema.Types.ObjectId, ref: "Author" },
        content: String,
      });
      Post = mongoose.model("Post", postSchema);

      //an author has many posts
      const authorSchema = new Schema({
        firstName: String,
        lastName: String,
      });
      Author = mongoose.model("Author", authorSchema);
    });

    //create 2 x categories, 1 x author and 10 x posts
    beforeEach(async () => {
      const category = await Category.create({
        name: rando(),
      });
      categories = [category];

      const category2 = await Category.create({
        name: rando(),
      });
      categories.push(category2);

      const author = await Author.create({
        firstName: rando(),
        lastName: rando(),
      });
      authors = [author];

      //create multi category posts
      posts = [];
      for (let i = 0; i < 5; i++) {
        const newPost = new Post({
          title: rando(),
          categories: categories,
          author: author,
          content: rando(),
        });
        posts.push(newPost);
        await newPost.save();
      }
    });

    afterEach(async () => {
      await Category.deleteMany({});
      await Post.deleteMany({});
      await Author.deleteMany({});
    });

    const required = [
      "modelArray",
      "storeWhere",
      "arrayPop",
      "mongooseModel",
      "idField",
    ];
    required.forEach((fieldName) => {
      it(`check mandatory field ${fieldName}`, async () => {
        const msg = "Missing mandatory field ";

        const opts = {
          modelArray: categories,
          storeWhere: "posts",
          arrayPop: true,
          mongooseModel: Post,
          idField: "categories",
        };
        delete opts[fieldName];

        try {
          await reversePopulate(opts);
        } catch (err) {
          assert.notDeepEqual(err, null);
          assert.equal(err.message, msg + fieldName);
        }
      });
    });

    //populate categories with their associated posts when the relationship is stored on the post model
    it("should successfully reverse populate a many-to-many relationship", async () => {
      const opts = {
        modelArray: categories,
        storeWhere: "posts",
        arrayPop: true,
        mongooseModel: Post,
        idField: "categories",
      };

      const catResult = await reversePopulate(opts);
      //expect catResult and categories to be the same
      assert.equal(catResult.length, 2);
      idsMatch(catResult, categories);

      //expect each catResult to contain the posts
      catResult.forEach((category) => {
        assert.equal(category.posts.length, 5);
        idsMatch(category.posts, posts);
      });
    });

    //populate authors with their associated posts when the relationship is stored on the post model
    it("should successfully reverse populate a one-to-many relationship", async () => {
      const opts = {
        modelArray: authors,
        storeWhere: "posts",
        arrayPop: true,
        mongooseModel: Post,
        idField: "author",
      };
      const authResult = await reversePopulate(opts);
      //expect catResult and categories to be the same
      assert.equal(authResult.length, 1);
      idsMatch(authResult, authors);

      //expect each catResult to contain the posts
      authResult.forEach((author) => {
        idsMatch(author.posts, posts);
        assert.equal(author.posts.length, 5);
      });
    });

    //test to ensure filtering results works as expected
    it('should "filter" the query results', async () => {
      //pick a random post to be filtered (the first one)
      const firstPost = posts[0];

      const opts = {
        modelArray: authors,
        storeWhere: "posts",
        arrayPop: true,
        mongooseModel: Post,
        idField: "author",
        filters: { title: { $ne: firstPost.title } },
      };
      const authResult = await reversePopulate(opts);
      assert.equal(authResult.length, 1);
      const author = authResult[0];

      //the authors posts should exclude the title passed as a filter
      //there are 10 posts for this author and 1 title is excluded so expect 9
      assert.equal(author.posts.length, 4);
      author.posts.forEach((post) => {
        assert.notEqual(firstPost.title, post.title);
      });
    });

    it('should "select" only the desired fields', async () => {
      const opts = {
        modelArray: authors,
        storeWhere: "posts",
        arrayPop: true,
        mongooseModel: Post,
        idField: "author",
        select: "title",
      };
      const authResult = await reversePopulate(opts);
      assert.equal(authResult.length, 1);
      const author = authResult[0];

      assert.equal(author.posts.length, 5);
      author.posts.forEach((post) => {
        //expect these two to be populated
        //author is automatically included as it's required to perform the populate
        assert.notEqual(typeof post.author, "undefined");
        assert.notEqual(typeof post.title, "undefined");
        //expect this to be undefined
        assert.equal(typeof post.catgegory, "undefined");
      });
    });

    it('should "sort" the results returned', async () => {
      const sortedTitles = _.pluck(posts, "title").sort();

      const opts = {
        modelArray: authors,
        storeWhere: "posts",
        arrayPop: true,
        mongooseModel: Post,
        idField: "author",
        sort: "title",
      };
      const authResult = await reversePopulate(opts);
      assert.equal(authResult.length, 1);
      const author = authResult[0];

      assert.equal(author.posts.length, 5);
      const postTitles = _.pluck(author.posts, "title");
      assert.deepEqual(sortedTitles, postTitles);
    });

    //use reverse populate to populate posts within author
    //use standard populate to nest categories in posts
    it('should "populate" the results returned', async () => {
      const opts = {
        modelArray: authors,
        storeWhere: "posts",
        arrayPop: true,
        mongooseModel: Post,
        idField: "author",
        populate: "categories",
      };
      const authResult = await reversePopulate(opts);
      assert.equal(authResult.length, 1);
      idsMatch(authResult, authors);

      const author = authResult[0];
      author.posts.forEach((post) => {
        assert.equal(post.categories.length, 2);
        idsMatch(post.categories, categories);
      });
    });
  });

  describe("singular results", () => {
    let Person, Passport;
    let person1, person2, passport1, passport2;

    //define schemas and models for tests
    before(async () => {
      //a person has one passport
      const personSchema = new Schema({
        firstName: String,
        lastName: String,
        dob: Date,
      });
      Person = mongoose.model("Person", personSchema);

      //a passport has one owner (person)
      const passportSchema = new Schema({
        number: String,
        expiry: Date,
        owner: { type: Schema.Types.ObjectId, ref: "Person" },
      });
      Passport = mongoose.model("Passport", passportSchema);
    });

    //create 2 x people, 2 x passports
    beforeEach(async () => {
      const person = await Person.create({
        firstName: rando(),
        lastName: rando(),
        dob: new Date(1984, 6, 27),
      });

      person1 = person;

      const passport = await Passport.create({
        number: rando(),
        expiry: new Date(2017, 1, 1),
        owner: person,
      });

      passport1 = passport;

      const secondPerson = await Person.create({
        firstName: rando(),
        lastName: rando(),
        dob: new Date(1984, 6, 27),
      });

      person2 = secondPerson;

      const secondPassport = await Passport.create({
        number: rando(),
        expiry: new Date(2017, 1, 1),
        owner: secondPerson,
      });
      passport2 = secondPassport;
    });

    afterEach(async () => {
      await Person.deleteMany({});
      await Passport.deleteMany({});
    });

    it("should successfully reverse populate a one-to-one relationship", async () => {
      const persons = await Person.find({});
      const opts = {
        modelArray: persons,
        storeWhere: "passport",
        arrayPop: false,
        mongooseModel: Passport,
        idField: "owner",
      };
      //as this is one-to-one result should not be populated inside an array
      const personsResult = await reversePopulate(opts);
      personsResult.forEach((person) => {
        //if this is person1, check against passport1
        if (person._id.equals(person1._id)) {
          idMatch(person.passport, passport1);
          //if this is person2, check against passport2
        } else {
          idMatch(person.passport, passport2);
        }
      });
    });
  });
});

/*
 * Helper functions
 */

//compare an array of mongoose objects
const idsMatch = (arr1, arr2) => {
  assert.equal(arr1.length, arr2.length);

  const arr1IDs = pluckIds(arr1);
  const arr2IDs = pluckIds(arr2);

  const diff = _.difference(arr1IDs, arr2IDs);
  assert.equal(diff.length, 0);
};

const pluckIds = (array) => {
  return array.map((obj) => {
    return obj._id.toString();
  });
};

//compare two mongoose objects using _id
const idMatch = (obj1, obj2) => {
  const compare = obj1._id.equals(obj2._id);
  assert(compare);
};
