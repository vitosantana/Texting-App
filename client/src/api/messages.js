import axios from 'axios';

const API = 'http://localhost:5000/api/messages';

export const receiveMessages = (userId, token) => 
    axios.get(`${API}/${userId}`, {
        headers: {
            Authorization: `Bearer ${token}`
        }
    });

    export const sendMessageToDb = (data, token) => {
         return axios.post(API, data, {
            headers: {
                Authorization: `Bearer ${token}`
            }
        })
    }

    export const getConversationSummaries = (token) => {
        return axios.get(
            `${API}/conversation-summaries`,
            {
                headers: {
                    Authorization: `Bearer ${token}`
                }
            }
        );
    };