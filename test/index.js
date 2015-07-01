var reversePopulate = require('../index.js');

var assert = require('assert');
var async = require('async');
var _ = require('underscore');
var mongoose = require('mongoose');

mongoose.connect('mongodb://localhost/mongoose-reverse-populate-test');
var Schema = mongoose.Schema;


var rando = function() {
	return Math.floor(Math.random() * (1 << 24)).toString(16);
};

describe('reverse populate', function() {
	describe('multiple results', function() {
		var Category, Post, Author;
		var categories = [];
		var posts = [];
		var authors = [];

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
			var opts = {
				modelArray: categories,
				storeWhere: "posts",
				arrayPop: true,
				mongooseModel: Post,
				idField: "categories"
			}
			reversePopulate(opts, function(err, catResult) {
				//expect catResult and categories to be the same
				assert.equal(catResult.length, 2);
				idsMatch(catResult, categories);

				//expect each catResult to contain the posts
				catResult.forEach(function(category) {
					assert.equal(category.posts.length, 5);
					idsMatch(category.posts, posts);
				});

				done()
			})
		});

		//populate authors with their associated posts when the relationship is stored on the post model
		it('should successfully reverse populate a one-to-many relationship', function(done) {
			var opts = {
				modelArray: authors,
				storeWhere: "posts",
				arrayPop: true,
				mongooseModel: Post,
				idField: "author"
			}
			reversePopulate(opts, function(err, authResult) {
				//expect catResult and categories to be the same
				assert.equal(authResult.length, 1);
				idsMatch(authResult, authors);

				//expect each catResult to contain the posts
				authResult.forEach(function(author) {
					idsMatch(author.posts, posts);
					assert.equal(author.posts.length, 5);
				});
				done();
			});
		});
	});

	describe('singular results', function() {
		var Person, Passport;
		var person1;
		var passport1;
		var person2;
		var passport2;

		before(function(done) {

			//a person has one passport
			var personSchema = new Schema({
				firstName: String,
				lastName: String,
				dob: Date
			});
			Person = mongoose.model('Person', personSchema);

			//a passport has one owner (person)
			var passportSchema = new Schema({
				number: String,
				expiry: Date,
				owner: { type: Schema.Types.ObjectId, ref: 'Person' }
			});
			Passport = mongoose.model('Passport', passportSchema);

			Person.create({
				firstName: rando(),
				lastName: rando(),
				dob: new Date(1984, 6, 27)
			}, function (err, person) {
				person1 = person;

				Passport.create({
					number: rando(),
					expiry: new Date(2017, 1, 1),
					owner: person
				}, function(err, passport) {
					passport1 = passport;

					Person.create({
						firstName: rando(),
						lastName: rando(),
						dob: new Date(1984, 6, 27)
					}, function (err, person) {
						person2 = person;

						Passport.create({
							number: rando(),
							expiry: new Date(2017, 1, 1),
							owner: person
						}, function(err, passport) {
							passport2 = passport;
							done();
						});
					});

				});
			});

		});

		it('should successfully reverse populate a one-to-one relationship', function(done) {
			Person.find().exec(function(err, persons) {
				var opts = {
					modelArray: persons,
					storeWhere: "passport",
					arrayPop: false,
					mongooseModel: Passport,
					idField: "owner"
				}
				//as this is one-to-one result should not be populated inside an array
				reversePopulate(opts, function(err, personsResult) {
					personsResult.forEach(function(person) {
						//if this is person1, check against passport1
						if (person._id.equals(person1._id)) {
							idMatch(person.passport, passport1);
						//if this is person2, check against passport2
						} else {
							idMatch(person.passport, passport2);
						}
					});
					done();
				});
			});
		});

		after(function(done) {
			async.parallel([
				function(cb) { Person.remove({}, cb); },
				function(cb) { Passport.remove({}, cb); },
			], done)
		});
	});
});

/*
 * Helper functions
*/

//compare an array of mongoose objects
var idsMatch = function(arr1, arr2) {
	assert.equal(arr1.length, arr2.length);

	var arr1IDs = pluckIds(arr1);
	var arr2IDs = pluckIds(arr2);
	
	var diff = _.difference(arr1IDs, arr2IDs);
	assert.equal(diff.length, 0);
};

var pluckIds = function(array) {
	return array.map(function(obj) { return obj._id.toString() });
};

//compare two mongoose objects using _id
var idMatch = function(obj1, obj2) {
	var compare = obj1._id.equals(obj2._id);
	assert(compare);
}
