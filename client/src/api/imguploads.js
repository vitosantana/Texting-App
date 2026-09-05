import axios from 'axios';

const UPLOAD_API = 'http://localhost:5000/api/uploads';

export const uploadImage = (file, token) => {
    const formData = new FormData();

    formData.append('image', file);

    return axios.post(
        UPLOAD_API,
        formData,
        {
            headers: {
                Authorization: `Bearer ${token}`
            }
        }
    );
};