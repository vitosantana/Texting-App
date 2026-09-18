import axios from 'axios';

const API = 'http://localhost:5000/api/groups';

export const getGroups = (token) => {
    return axios.get(API, {
        headers: {
            Authorization: `Bearer ${token}`
        }
    });
};

export const createGroup = (groupData, token) => {
    console.log('createGroup API called:', groupData);
    return axios.post(
         'http://localhost:5000/api/groups',
        groupData,
        {
            headers: {
                Authorization: `Bearer ${token}`
            }
        }
    );
};

export const getGroupMessages = (groupId, token) => {
    return axios.get(
        `${API}/${groupId}/messages`,
        {
            headers: {
                Authorization: `Bearer ${token}`
            }
        }
    );
};

export const sendGroupMessage = (
    groupId,
    messageData,
    token
) => {
    return axios.post(
        `${API}/${groupId}/messages`,
        messageData,
        {
            headers: {
                Authorization: `Bearer ${token}`
            }
        }
    );
};