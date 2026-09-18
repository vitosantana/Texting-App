const mongoose = require('mongoose');

const messageSchema = new mongoose.Schema (
    {
        senderId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
            required: true
        },
        receiverId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
            default: null
        },

        groupId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Group',
            default: null
        },

        
        text: {
            type: String,
            default: ''
        },

        imageUrl: {
            type: String,
            default: ''
        },
        // Read Receipts
        status: {
            type: String,
            enum: ['sent', 'delivered', 'seen'],
            default: 'sent'
        },
        
        edited: {
            type: Boolean,
            default: false
        }
    },
    { timestamps: true}
    
);

module.exports = mongoose.model('Message', messageSchema);