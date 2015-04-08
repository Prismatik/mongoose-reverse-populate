var reversePopulate = require('../index.js');

var assert = require('assert');
var async = require('async');
var _ = require('lodash');

var mongoose = require('mongoose');
mongoose.connect('mongodb://localhost/mongoose-reverse-populate-test');
var ObjectId = require("mongoose").Types.ObjectId

var Schema = mongoose.Schema;
var ObjectId = Schema.ObjectId;

var rando = function() {
	return Math.floor(Math.random() * (1 << 24)).toString(16);
};

describe('reverse populate', function() {
	describe('multiple results', function() {
		var categories = [];
		var posts = [];
		var authors = [];
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
					}, function(err, author) {
						assert.deepEqual(err, null);
						authors.push(author);

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
			reversePopulate(categories, "posts", true, Post, "categories", function(err, catResult) {
				//expect catResult and categories to be the same
				idsMatch(catResult, categories);

				//expect each catResult to contain the posts
				catResult.forEach(function(category) {
					idsMatch(category.posts, posts);
				});

				done()
			})
		});

		it('should successfully reverse populate a one-to-many relationship', function(done) {
			reversePopulate(authors, "posts", true, Post, "author", function(err, authResult) {
				//expect catResult and categories to be the same
				idsMatch(authResult, authors);

				//expect each catResult to contain the posts
				authResult.forEach(function(author) {
					idsMatch(author.posts, posts);
				});
				done();
			});
		});
	});

	describe('singular results', function() {
		xit('should successfully reverse populate a one-to-one relationship', function(done) {});
	});
});

/*
 * Helper functions
*/

var idsMatch = function(arr1, arr2) {
	assert.equal(arr1.length, arr2.length);

	var arr1IDs = pluckIds(arr1);
	var arr2IDs = pluckIds(arr2);

	//console.log('comparing', arr1IDs)
	//console.log('to       ', arr2IDs);
	
	var diff = _.difference(arr1IDs, arr2IDs);
	assert.equal(diff.length, 0);
};

var pluckIds = function(array) {
	return array.map(function(obj) { return obj._id.toString() });
};
