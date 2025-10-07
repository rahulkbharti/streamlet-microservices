import prisma from "../utils/prisma.js";

const getChannels = async (req, res) => {
    try {
        const channels = await prisma.channel.findMany();
        res.json(channels);
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch channels' });
    }
};

const createChannel = async (req, res) => {
    if (!req.user) {
        return res.status(401).json({ error: 'Unauthorized' });
    }
    try {
        const { name, description } = req.body;
        const channel = await prisma.channel.create({
            data: { channelName: name, description, profilePictureUrl: '', user: { connect: { id: req.user.id } } }
        });
        res.status(201).json(channel);
    } catch (error) {
        res.status(500).json({ error: 'Failed to create channel' });
    }
};

const updateChannel = async (req, res) => {
    if (!req.user) {
        return res.status(401).json({ error: 'Unauthorized' });
    }
    try {
        const { id } = req.params;
        const { name, description } = req.body;
        const channel = await prisma.channel.update({
            where: { id: String(id) },
            data: { channelName: name, description }
        });
        res.json(channel);
    } catch (error) {
        res.status(500).json({ error: 'Failed to update channel' });
    }
};

const deleteChannel = async (req, res) => {
    try {
        const { id } = req.params;
        await prisma.channel.delete({
            where: { id: String(id) }
        });
        res.status(204).send();
    } catch (error) {
        res.status(500).json({ error: 'Failed to delete channel' });
    }
};

export {
    getChannels,
    createChannel,
    updateChannel,
    deleteChannel
};