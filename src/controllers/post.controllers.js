const generateCaption = require("../services/ai.service");
const postModel = require("../models/post.model");
const { uploadImage } = require("../services/cloud.service");
const { v4: uuidv4 } = require("uuid");
const CommentModel = require("../models/comment.model");
const PostModel = require("../models/post.model");
const LikeModel = require("../models/like.model");
const mongoose = require("mongoose");
const { Types } = require("mongoose");

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
    const { comment, postId } = req.body;

    if (!comment || !postId) {
      return res
        .status(400)
        .json({ message: "Comment and postId are required" });
    }

    const isPostExist = await PostModel.findById(postId);
    if (!isPostExist) {
      return res.status(404).json({ message: "Post not found." });
    }

    await CommentModel.create({
      comment,
      post: postId,
      user: req.user._id,
    });

    return res.status(201).json({
      message: "Comment created successfully.",
    });
  } catch (error) {
    console.error("Error creating comment:", error);
    return res.status(500).json({ message: "Internal server error" });
  }
}

async function getCommentController(req, res) {
  try {
    const { postId } = req.body;

    if (!postId) {
      return res.status(400).json({
        message: "Post Id is required.",
      });
    }

    const comments = await CommentModel.find({ post: postId })
      .populate("user", "username") // sirf required user fields
      .sort({ createdAt: -1 }); // latest first

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

    console.log(postIds);

    // Step 3: Find which posts the logged-in user liked
    let likedDocs = [];

    if (req.user) {
      console.log(req.user);

      const postObjectIds = postIds.map(
        (id) => new mongoose.Types.ObjectId(id)
      );

      console.log("postObjectIds", postObjectIds);

      likedDocs = await LikeModel.find({
        user: req.user._id, // correct field name
        post: { $in: postObjectIds }, // correct field name
      }).select("post"); // correct field to select

      console.log("LikedDocs:", likedDocs);
    }

    // Step 4: Make a Set for fast lookup
    const likedSet = new Set(likedDocs.map((doc) => doc.post?.toString()));

    console.log(likedSet);

    // Step 5: Inject isLiked into posts
    posts = posts.map((p) => ({
      ...p,
      isLiked: likedSet.has(p._id.toString()),
    }));

    console.log(posts);

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

module.exports = {
  createPostController,
  createCommentController,
  getCommentController,
  ToggleLikeController,
  asyncGenerateCaption,
  asyncGetPosts,
  GetPostsByUserId
};
