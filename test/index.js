var reversePopulate = require('../index.js');

var assert = require('assert');
var async = require('async');

var mongoose = require('mongoose');
mongoose.connect('mongodb://localhost/mongoose-reverse-populate-test');
var ObjectId = require("mongoose").Types.ObjectId

var Schema = mongoose.Schema;
var ObjectId = Schema.ObjectId;

var rando = function() {
	return Math.floor(Math.random() * (1 << 24)).toString(16);
};

describe('reverse populate', function() {
	var categories = [];
	var posts = [];
	var author;
	var Category, Post, Author;

	before(function(done) {

		//a category has many posts
		var categorySchema = new Schema({
			name: String,
		});
		Category = mongoose.model('Category', categorySchema);

		//a post can have many categories
		//a post can ONLY have one author
		var postSchema = new Schema({
			title: String,
			categories: [{ type: Schema.Types.ObjectId, ref: 'Category' }],
			author: { type: Schema.Types.ObjectId, ref: 'Author' }
		});
		Post = mongoose.model('Post', postSchema);

		//an author has many posts
		var authorSchema = new Schema({
			firstName: String,
			lastName: String
		});
		Author = mongoose.model('Author', authorSchema);

		Category.create({
			name: rando()
		}, function(err, category) {
			assert.deepEqual(err, null);
			categories.push(category);

			Category.create({
				name: rando()
			}, function(err, category) {
				assert.deepEqual(err, null);
				categories.push(category);

				Author.create({
					firstName: rando(),
					lastName: rando(),
				}, function(err, auth) {
					assert.deepEqual(err, null);
					author = auth;

					//create multi category posts
					for (i = 0; i < 5; i++) {
						newPost = new Post({
							title: rando(),
							categories: categories,
							author: author
						});
						posts.push(newPost);
					}
					
					//save all posts
					async.each(posts, function(post, cb) {
						post.save(cb)
					}, function(err, result) {
						console.log(posts);
						done();
					})

				});
			});

		});
	
	after(function(done) {
		async.parallel([
			function(cb) { Category.remove({}, cb); },
			function(cb) { Post.remove({}, cb); },
			function(cb) { Author.remove({}, cb); }
		], done)

	});

	});
	//populate categories with their associated posts when the relationship is stored on the post model
	it('should successfully reverse populate a many-to-many relationship', function(done) {
		reversePopulate(categories, "posts", true, Post, "categories", function(err, categories) {
			assert.equal(categories.length, 2);

			categories.forEach(function(category) {
				//find the matching category
				var catMatch = findMatch(category, categories);
				//check a match is found
				assert(catMatch);
				//check the match is identical to the category
				compareObjects(["name"], category, catMatch);
				//expect five posts per category
				assert.equal(category.posts.length, 5);

				console.log('category.posts', category.posts);

				category.posts.forEach(function(post) {
					var postMatch = findMatch(post, posts);
					//check a match is found
					assert(postMatch);
					//check the match is identical to the post
					compareObjects(["title", "categories"], post, postMatch);
				});
			});

			done()
		})
	});

	xit('should successfully reverse populate a one-to-many relationship', function(done) {

	});
});

/*
 * Helper functions
*/

//find two matching mongo objects (using _id)
var findMatch = function(val, array) {
	for (i = 0; i < array.length; i++) {
		if (val._id.equals(array[i]._id)) return array[i];
	}
	return false;
}

//compare the specified properties of two objects
var compareObjects = function(properties, obj1, obj2) {
	properties.forEach(function(property) {
		checkMatch(obj1[property], obj2[property]);
	});
}

//check if value is a MongoId or not
var isMongoId = function(value) {
	return !!value._bsontype;
}

//check if two properties are equal (including MongoIds)
var checkMatch = function(value1, value2) {
	if (isMongoId(value1)) {
		assert(value1.equals(value2));
	} else {
		assert.equal(value1, value2);
	}
}
