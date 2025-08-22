const generateCaption = require("../services/ai.service");
const postModel = require("../models/post.model");
const uploadImage = require("../services/cloud.service");
const { v4: uuidv4 } = require("uuid");
const CommentModel = require("../models/comment.model");
const PostModel = require("../models/post.model");
const LikeModel = require("../models/like.model");
const { Types } = require("mongoose");

async function createPostController(req, res) {
  try {
    const file = req.file;

    if (!file) {
      return res.status(400).json({ message: "No image file provided" });
    }

    const base64ImageFile = file.buffer.toString("base64");

    // const caption = await generateCaption(base64ImageFile);
    // const url = await uploadImage(file.buffer, uuidv4());

    const [caption, url] = await Promise.all([
      generateCaption(base64ImageFile),
      uploadImage(file.buffer, uuidv4()),
    ]);

    const post = await postModel.create({
      image: url,
      caption: caption,
      user: req.user._id,
    });

    return res.status(200).json({
      caption,
      post: {
        postId: post._id,
        image: url,
        caption: caption,
        user: {
          userId: req.user._id,
          username: req.user.username,
        },
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

async function LikeController(req, res) {
  try {
    const { id } = req.params;
    console.log(id)
    if (!id) {
      return res.status(400).json({
        message: "Post id not Found",
      });
    }
    const post = await postModel.findById(id);

    if (!post) {
      return res.status(404).json({
        message: "Post not found",
      });
    }

    const existingLike = await LikeModel.findOne({
      post: id,
      user: req.user._id,
    });

    if (existingLike) {
      return res.status(200).json({ message: "Already liked this post." });
    }

    const newLike = await LikeModel.create({
      post: id,
      user: req.user._id,
    });

    post.likesCount += 1;

    await post.save();

    return res.status(201).json({
      message: "Like added successfully.",
      like: newLike,
      likesCount: post.likesCount,
    });
  } catch (error) {
    return res.status(500).json({
      message: "Interval Server Error",
    });
  }
}

async function DisLikeController(req, res) {
  try {
    const { postId } = req.params;

    if (!postId) {
      return res.status(400).json({ message: "Post ID is required" });
    }

    const post = await postModel.findById(postId);

    if (!post) {
      return res.status(404).json({ message: "Post not found" });
    }

    const existingLike = await LikeModel.findOne({
      post: postId,
      user: req.user._id,
    });

    if (!existingLike) {
      return res
        .status(400)
        .json({ message: "You have not liked this post yet" });
    }

    await LikeModel.findOneAndDelete({
      post: postId,
      user: req.user._id,
    });

    if (post.likesCount > 0) {
      post.likesCount -= 1;
    }

    await post.save();

    return res.status(200).json({ message: "Post disliked successfully" });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Internal server error" });
  }
}

async function asyncGenerateCaption(req, res) {
  const file = req.file;
  const { personality } = req.body;

  console.log(file);

  if (!file) {
    return res.status(400).json({ message: "No image file provided" });
  }

  const base64ImageFile = file.buffer.toString("base64");

  try {
    const response = await generateCaption(base64ImageFile, personality);
    console.log(response);

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

    
    if (req.user) {
      likedDocs = await LikeModel.find({
        userId: req.user._id,
        postId: { $in: postIds },
      }).select("postId");
    }

    // Step 4: Make a Set for fast lookup
    const likedSet = new Set(likedDocs.map((doc) => doc.postId.toString()));

    // Step 5: Inject isLiked into posts
    posts = posts.map((p) => ({
      ...p,
      isLiked: likedSet.has(p._id.toString()),
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
  console.log(id);

  try {
    const posts = await postModel.find({ user: new Types.ObjectId(id) });

    if (!posts || posts.length === 0) {
      return res.status(200).json({
        message: "No Post found",
        posts: [],
      });
    }

    console.log(posts);

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
  LikeController,
  DisLikeController,
  asyncGenerateCaption,
  asyncGetPosts,
  GetPostsByUserId,
};
