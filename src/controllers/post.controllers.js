const generateCaption = require("../services/ai.service");
const postModel = require("../models/post.model");
const { uploadImage } = require("../services/cloud.service");
const { v4: uuidv4 } = require("uuid");
const CommentModel = require("../models/comment.model");
const PostModel = require("../models/post.model");
const LikeModel = require("../models/like.model");
const mongoose = require("mongoose");
const saveModel = require("../models/save.model");
const { Types } = mongoose;

async function createPostController(req, res) {
  try {
    const file = req.file;
    const { showCurrentCaption } = req.body;
    const user = req.user;

    console.log("req.file:", req.file);
    console.log("req.body:", req.body);

    if (!file || !showCurrentCaption) {
      return res.status(400).json({ message: "No content provided" });
    }

    const url = await uploadImage(file.buffer, uuidv4());

    const post = await postModel.create({
      user: user._id,
      image: url.url,
      caption: showCurrentCaption,
    });

    return res.status(201).json({
      post: {
        postId: post._id,
        image: url.url,
        caption: showCurrentCaption,
        user: {
          userId: user._id,
          username: user.username,
        },
        likesCount: 0,
        commentCount: 0,
        saveCount: 0,
        shareCount: 0,
      },
    });
  } catch (error) {
    res
      .status(500)
      .json({ message: "Error creating post", error: error.message });
  }
}

async function createCommentController(req, res) {
  try {
    const { postId } = req.params;
    const { comment } = req.body;

    console.log(postId, comment);

    if (!comment || !postId) {
      return res
        .status(400)
        .json({ message: "Comment and postId are required" });
    }

    const isPostExist = await PostModel.findById(postId);
    if (!isPostExist) {
      return res.status(404).json({ message: "Post not found." });
    }

    const newComment = await CommentModel.create({
      comment,
      post: postId,
      user: req.user._id,
    });

    const updatedPost = await PostModel.findByIdAndUpdate(
      postId,
      { $inc: { commentCount: 1 } },
      { new: true } // returns updated doc
    );

    const populatedComment = await CommentModel.aggregate([
      { $match: { _id: new mongoose.Types.ObjectId(newComment._id) } },
      {
        $lookup: {
          from: "userprofiles",
          localField: "user",
          foreignField: "userId",
          as: "profile",
        },
      },

      { $unwind: { path: "$profile", preserveNullAndEmptyArrays: true } },

      // Select only required fields
      {
        $project: {
          _id: 1,
          comment: 1,
          createdAt: 1,
          user: 1,
          "profile.avatarUrl": 1,
          "profile.displayName": 1,
        },
      },
    ]);

    return res.status(201).json({
      message: "Comment created successfully.",
      comment: populatedComment,
      commentCount: updatedPost.commentCount,
    });
  } catch (error) {
    console.error("Error creating comment:", error);
    return res.status(500).json({ message: `${error} Internal server error` });
  }
}

async function editCommentController(req, res) {
  try {
    const { postId, commentId } = req.params;
    const { comment } = req.body;

    if (!comment) {
      return res.status(400).json({ message: "Comment text is required." });
    }

    // Check if post exists
    const isPostExist = await PostModel.findById(postId);
    if (!isPostExist) {
      return res.status(404).json({ message: "Post not found." });
    }

    const newComment = await CommentModel.findOneAndUpdate(
      { _id: commentId, post: postId, user: req.user._id },
      { $set: { comment } },
      { new: true }
    );

    if (!newComment) {
      return res
        .status(404)
        .json({ message: "Comment not found or not authorized." });
    }

    // Populate user profile
    const populatedComment = await CommentModel.aggregate([
      { $match: { _id: new mongoose.Types.ObjectId(newComment._id) } },
      {
        $lookup: {
          from: "userprofiles",
          localField: "user",
          foreignField: "userId",
          as: "profile",
        },
      },
      { $unwind: { path: "$profile", preserveNullAndEmptyArrays: true } },
      {
        $project: {
          _id: 1,
          comment: 1,
          createdAt: 1,
          user: 1,
          "profile.avatarUrl": 1,
          "profile.displayName": 1,
        },
      },
    ]);

    return res.status(200).json({
      message: "Comment updated successfully.",
      comment: populatedComment[0],
    });
  } catch (error) {
    console.error("Error editing comment:", error);
    return res.status(500).json({ message: `${error} Internal server error` });
  }
}

async function deleteCommentController(req, res) {
  try {
    const { postId, commentId } = req.params;
    // Delete comment only if it belongs to the post & user
    const deleted = await CommentModel.findOneAndDelete({
      _id: commentId,
      post: postId,
      user: req.user._id,
    });

    if (!deleted) {
      return res.status(404).json({
        message: "Comment not found or not authorized.",
      });
    }

    let post = await postModel.findByIdAndUpdate(
      postId,
      { $inc: { commentCount: -1 } },
      { new: true }
    );

    if (post.commentCount < 0) {
      post.commentCount = 0;
      await post.save();
    }

    return res.status(200).json({
      message: "Comment deleted successfully.",
      commentId,
      commentCount: post.commentCount,
    });
  } catch (error) {
    console.error("Error deleting comment:", error);
    return res.status(500).json({ message: `${error} Internal server error` });
  }
}

async function getCommentController(req, res) {
  try {
    const { postId } = req.params;

    if (!postId) {
      return res.status(400).json({
        message: "Post Id is required.",
      });
    }

    const comments = await CommentModel.aggregate([
      { $match: { post: new mongoose.Types.ObjectId(postId) } },

      {
        $lookup: {
          from: "userprofiles",
          localField: "user",
          foreignField: "userId",
          as: "profile",
        },
      },

      { $unwind: { path: "$profile", preserveNullAndEmptyArrays: true } },

      // Select only required fields
      {
        $project: {
          _id: 1,
          comment: 1,
          createdAt: 1,
          user: 1,
          "profile.avatarUrl": 1,
          "profile.displayName": 1,
        },
      },
      { $sort: { createdAt: -1 } },
    ]);

    return res.status(200).json({
      message: "Comments fetched successfully.",
      comments,
    });
  } catch (error) {
    console.error("Error getting comments:", error);
    return res.status(500).json({ message: "Internal server error" });
  }
}

async function ToggleLikeController(req, res) {
  try {
    const { postId } = req.params;

    if (!postId) {
      return res.status(400).json({ message: "Post ID is required" });
    }

    const post = await postModel.findById(postId);

    if (!post) {
      return res.status(404).json({ message: "Post not found" });
    }

    // Check if user already liked this post
    const existingLike = await LikeModel.findOne({
      post: postId,
      user: req.user._id,
    });

    if (existingLike) {
      // 👉 Unlike
      await existingLike.deleteOne();
      post.likesCount = Math.max(0, post.likesCount - 1);
      await post.save();

      return res.status(200).json({
        message: "Like removed successfully.",
        likesCount: post.likesCount,
        isLiked: false,
      });
    }

    // 👉 Otherwise Like
    const newLike = await LikeModel.create({
      post: postId,
      user: req.user._id,
    });

    post.likesCount += 1;
    await post.save();

    return res.status(201).json({
      message: "Like added successfully.",
      like: newLike,
      likesCount: post.likesCount,
      isLiked: true,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Internal server error" });
  }
}

async function asyncGenerateCaption(req, res) {
  const file = req.file;
  const { personality } = req.body;

  if (!file || !personality) {
    return res.status(400).json({ message: "No content provided" });
  }

  const base64ImageFile = file.buffer.toString("base64");

  try {
    const response = await generateCaption(base64ImageFile, personality);

    res.status(201).json({
      message: "Caption generated successfully.",
      response,
    });
  } catch (error) {
    res.status(404).json({
      message: "unable to generate caption.",
    });
  }
}

async function asyncGetPosts(req, res) {
  try {
    const totalPosts = await PostModel.countDocuments();

    let sampleSize = Math.min(totalPosts, 10);

    let posts = await PostModel.aggregate([
      { $sample: { size: sampleSize } },
      // 🔹 Join with User collection (to get username, email etc.)
      {
        $lookup: {
          from: "users", // collection name in DB
          localField: "user", // field in PostSchema
          foreignField: "_id", // field in UserSchema
          as: "userData",
        },
      },
      { $unwind: "$userData" },

      // 🔹 Join with UserProfile collection (to get avatarUrl)
      {
        $lookup: {
          from: "userprofiles", // collection name in DB
          localField: "user", // post.user = userId
          foreignField: "userId", // userProfile.userId
          as: "profileData",
        },
      },
      { $unwind: { path: "$profileData" } },

      // 🔹 Select only required fields
      {
        $project: {
          image: 1,
          caption: 1,
          likesCount: 1,
          commentCount: 1,
          shareCount: 1,
          saveCount: 1,
          createdAt: 1,
          "userData._id": 1,
          "userData.username": 1,
          "profileData.displayName": 1,
          "profileData.avatarUrl": 1,
        },
      },
    ]);

    const postIds = posts.map((p) => p._id);

    // Step 3: Find which posts the logged-in user liked
    let likedDocs = [];
    let saveDocs = [];

    if (req.user) {
      console.log(req.user);

      const postObjectIds = postIds.map(
        (id) => new mongoose.Types.ObjectId(id)
      );

      likedDocs = await LikeModel.find({
        user: req.user._id, // correct field name
        post: { $in: postObjectIds }, // correct field name
      }).select("post"); // correct field to select

      saveDocs = await saveModel
        .find({
          user: req.user._id,
          post: { $in: postObjectIds },
        })
        .select("post");
    }

    // Step 4: Make a Set for fast lookup
    const likedSet = new Set(likedDocs.map((doc) => doc.post?.toString()));
    const saveSet = new Set(saveDocs.map((doc) => doc.post?.toString()));

    // Step 5: Inject isLiked into posts
    posts = posts.map((p) => ({
      ...p,
      isLiked: likedSet.has(p._id.toString()),
      saved: saveSet.has(p._id.toString()),
    }));

    return res.status(200).json({
      success: true,
      count: posts.length,
      posts,
    });
  } catch (error) {
    console.error("Error fetching posts:", error);
    return res.status(500).json({
      success: false,
      message: "Internal Server Error",
    });
  }
}

async function GetPostsByUserId(req, res) {
  const { id } = req.params;

  try {
    const posts = await postModel.find({ user: new Types.ObjectId(id) });

    if (!posts || posts.length === 0) {
      return res.status(200).json({
        message: "No Post found",
        posts: [],
      });
    }

    return res.status(200).json({
      message: "Posts got successfully.",
      posts,
    });
  } catch (error) {
    console.log(error);
    res.status(500).json({
      message: `${error}+"Internal Server Error.`,
    });
  }
}
async function updateShareCountController(req, res) {
  try {
    const { postId } = req.params;
    console.log(postId);

    const post = await postModel.findByIdAndUpdate(
      postId,
      {
        $inc: { shareCount: 1 },
      },
      { new: true }
    );

    if (!post) {
      return res.status(404).json({ message: "Post not found." });
    }

    return res.status(200).json({
      message: "Post share count incremented successfully.",
      shareCount: post.shareCount,
    });
  } catch (error) {
    console.error("Error updating share count:", error);
    return res.status(500).json({ message: "Internal server error" });
  }
}

async function toggleSavePost(req, res) {
  try {
    const { postId } = req.params;
    const userId = req.user._id; // middleware se aayega

    // Check if post exists
    const post = await PostModel.findById(postId);
    if (!post) {
      return res.status(404).json({ message: "Post not found." });
    }

    // Check if already saved
    const existingSave = await saveModel.findOne({
      post: postId,
      user: userId,
    });

    if (existingSave) {
      // 🗑️ Unsaving post
      await saveModel.findByIdAndDelete(existingSave._id);

      return res.status(200).json({
        message: "Post unsaved",
        saved: false,
      });
    }

    const newSaved = await saveModel.create({ post: postId, user: userId });

      let savedPost = await saveModel.aggregate([
      { $match: { post: newSaved.post, user: newSaved.user } },
        // Join posts
        {
          $lookup: {
            from: "posts",
            localField: "post",
            foreignField: "_id",
            as: "post",
          },
        },
        { $unwind: "$post" },
        // Join user
        {
          $lookup: {
            from: "users",
            localField: "post.user",
            foreignField: "_id",
            as: "userData",
          },
        },
        { $unwind: "$userData" },
        // Join userProfile
        {
          $lookup: {
            from: "userprofiles",
            localField: "post.user",
            foreignField: "userId",
            as: "userProfile",
          },
        },
        { $unwind: "$userProfile" },
        {
          $project: {
            _id: 1,
            "post._id": 1,
            "post.caption": 1,
            "post.image": 1,
            "post.likesCount": 1,
            "post.commentCount": 1,
            "post.shareCount": 1,
            "post.createdAt": 1,
            "userData.username": 1,
            "userProfile.displayName": 1,
            "userProfile.avatarUrl": 1,
          },
        },
      ]);
      // Determine if current user has liked this post to include isLiked for client UI
      const liked = await LikeModel.exists({ user: userId, post: postId });
      if (savedPost[0]) {
        savedPost[0].isLiked = !!liked;
      }
      console.log(savedPost);
      return res
        .status(201)
        .json({ message: "Post saved", saved: true, save: savedPost });
  } catch (error) {
    console.error("Save Toggle Error:", error);
    return res.status(500).json({
      message: "Error toggling save",
      error: error.message,
    });
  }
}

async function getSaves(req, res) {
  try {
    const userId = req.user._id;

    let savedPosts = await saveModel.aggregate([
      { $match: { user: new mongoose.Types.ObjectId(userId) } },

      // Join posts
      {
        $lookup: {
          from: "posts",
          localField: "post",
          foreignField: "_id",
          as: "post",
        },
      },
      { $unwind: "$post" },

      // Join user
      {
        $lookup: {
          from: "users",
          localField: "post.user",
          foreignField: "_id",
          as: "userData",
        },
      },
      { $unwind: "$userData" },

      // Join userProfile
      {
        $lookup: {
          from: "userprofiles",
          localField: "post.user",
          foreignField: "userId",
          as: "userProfile",
        },
      },
      { $unwind: "$userProfile" },

      // Keep only needed fields
      {
        $project: {
          _id: 1,
          "post._id": 1,
          "post.caption": 1,
          "post.image": 1,
          "post.likesCount": 1,
          "post.commentCount": 1,
          "post.shareCount": 1,
          "post.createdAt": 1,
          "userData.username": 1,
          "userProfile.displayName": 1,
          "userProfile.avatarUrl": 1,
        },
      },
    ]);

    // Collect postIds
    const postIds = savedPosts.map((p) => p.post._id);
    const postObjectIds = postIds.map((id) => new mongoose.Types.ObjectId(id));

    // Find likes by current user for these posts
    const likedDocs = await LikeModel.find({
      user: req.user._id,
      post: { $in: postObjectIds },
    }).select("post");

    const likedSet = new Set(likedDocs.map((doc) => doc.post.toString()));

    // Add flags
    savedPosts = savedPosts.map((p) => ({
      ...p,
      isLiked: likedSet.has(p.post._id.toString()),
      saved: true,
    }));

    return res.status(200).json({
      message: "Saved Post Fetch Successfully.",
      count: savedPosts.length,
      savedPosts,
    });
  } catch (error) {
    res.status(500).json({
      message: "Error fetching saved posts",
      error: error.message,
    });
  }
}

async function getPostDetailsById(req, res) {
  try {
    const { id } = req.params;
    console.log(id);

    // ensure id is valid ObjectId
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ message: "Invalid post id" });
    }

    const posts = await PostModel.aggregate([
      { $match: { _id: new mongoose.Types.ObjectId(id) } }, // filter by id
      {
        $lookup: {
          from: "userprofiles", // collection name
          localField: "user", // field in PostModel
          foreignField: "userId", // field in UserProfile
          as: "userData",
        },
      },
      { $unwind: "$userData" },

      {
        $project: {
          image: 1,
          caption: 1,
          likesCount: 1,
          commentCount: 1,
          shareCount: 1,
          "userData.userId": 1,
          "userData.displayName": 1,
          "userData.avatarUrl": 1,
        },
      },
    ]);

    console.log(posts);

    if (!posts.length) {
      return res.status(404).json({ message: "Post not found" });
    }

    return res.status(200).json(posts[0]);
  } catch (error) {
    return res.status(500).json({ message: "Server error" });
  }
}

module.exports = {
  createPostController,
  createCommentController,
  getCommentController,
  ToggleLikeController,
  asyncGenerateCaption,
  asyncGetPosts,
  GetPostsByUserId,
  getPostDetailsById,
  editCommentController,
  deleteCommentController,
  updateShareCountController,
  toggleSavePost,
  getSaves,
};
