const express = require('express');
const mongoose = require('mongoose');
const Group = require('../models/Group');
const User = require('../models/User');
const authMiddleware = require('../middleware/authMiddleware');
const router = express.Router();
const Message = require('../models/Message');


router.post('/', authMiddleware, async (req, res) => {
    try {
        const currentUserId = String(req.user.userId);

        const {
            name,
            members
        } = req.body;

        // A group chat name is required
        if (!name || !name.trim()) {
            return res.status(400).json({
                message: 'Group name is required'
            });
        }

        //Group members must be sent as an array

        if (!Array.isArray(members)) {
            return res.status(400).json({
                message: 'Members must be an array'
            });
        }

        // Include the Group chat creator

        const memberIds = [
            ...members.map((memberId) => String(memberId)),
            currentUserId
        ];

        // Remove duplicate IDs
        const uniqueMemberIds = [...new Set(memberIds)];

        // Ensure every Id is a valid MongoDb ObjectId

        const hasInvalidId = uniqueMemberIds.some(
            (memberId) =>
                !mongoose.Types.ObjectId.isValid(memberId)
        );

        if (hasInvalidId) {
            return res.status(400).json({
                message: 'One or more member IDs are invalid'
            });
        }

        // Double check the validity of the user

        const existingUsers = await User.find({
            _id: {
                $in: uniqueMemberIds
            }
        }).select('id');

            if (existingUsers.length !== uniqueMemberIds.length) {
                return res.status(400).json({
                    message: 'One or more users do not exist'
                });
            }

            //Create the group chat

            const group = await Group.create({
                name: name.trim(),
                members: uniqueMemberIds,
                createdBy: currentUserId
            });
            
        
            // Return useful member information to the front end

            const populatedGroup = await Group.findById(group._id)
            .populate('members', 'username email')
            .populate('createdBy', 'username email');

            res.status(201).json(populatedGroup);
    } catch (error) {
        console.log('CREATE GROUP ERROR:', error);

        res.status(500).json({
            message: 'Server error'
        });
    }
})

router.get('/', authMiddleware, async (req, res) => {
    try {
        const currentUserId = String(req.user.userId);
        const groups = await Group.find({
            members: currentUserId
        })
        .populate('members', 'username email')
        .populate('createdBy', 'username email')
        .sort({ updatedAt: -1 });

        res.json(groups);
        
    } catch (error) {
        console.log('GET GROUPS ERROR:', error);
        res.status(500).json({
            message: 'Server error'
        });
    }
});

router.get(
    '/:groupId/messages',
    authMiddleware,
    async (req, res) => {
        try {
            const currentUserId = String(req.user.userId);
            const groupId = req.params.groupId;

            // Ensures the group exist
            const group = await Group.findById(groupId);

            if (!group) {
                return res.status(404).json({
                    message: 'Group not found'
                });
            }

            // Ensures the logged in user belongs to the group
            const isMember = group.members.some(
                (memberId) =>
                    String(memberId) === currentUserId
            );

            if (!isMember) {
                return res.status(403).json({
                    message: 'You are not a member of this group'
                });
            }

            // Get all messages belonging to the relevant group
            const messages = await Message.find({
                groupId
            })
            .populate('senderId', 'username')
            .sort({ createdAt: 1});

            res.json(messages);

        } catch (error){ 
        console.log('GET GROUP MESSAGES ERROR:',
            error
        );

        res.status(500).json({
            message: 'Server error'
        });
    }
}
    
);

router.post(
    '/:groupId/messages',
    authMiddleware,
    async (req, res) => {
        try {
            const currentUserId = String(req.user.userId);
            const groupId = req.params.groupId;
            const { text, imageUrl } = req.body;

            // Ensure there is a message to send
            if (!text?.trim() && !imageUrl) {
                return res.status(400).json({
                    message: 'Message cannot be empty'
                });
            }

            const group = await Group.findById(groupId);

            if (!group) {
                return res.status(404).json({
                    message: 'Group not found'
                });
            }

            //Ensures the sender belongs to the group
            const isMember = group.members.some(
                (memberId) =>
                    String(memberId) === currentUserId
            );

            if (!isMember) {
                return res.status(403).json({
                    message: 'You are not a member of this group'
                });
            }

            // Create the group message
            const message = await Message.create({
                senderId: currentUserId,
                // Ensure group messages doesn't have one receiver
                receiverId: null,
                groupId,
                text: text?.trim() || '',
                imageUrl: imageUrl || ''
            });

            console.log('GROUP MESSAGE CREATED:', message);

            //Populate sender so frontend knows who sent it
            const populatedMessage =
            await Message.findById(message._id)
            .populate('senderId', 'username');
            res.status(201).json(populatedMessage);
        } catch (error) {
            console.log(
                'CREATE GROUP MESSAGE ERROR:',
                error
            );

            res.status(500).json({
                message: 'Server error'
            });
        }
    }
);



module.exports = router;