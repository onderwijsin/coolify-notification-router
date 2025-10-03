export default [
    {
        keyword: /\b(re)?deploy\w*\b/i,
        targetChannelEnv: "DEPLOYMENTS_CHANNEL_ID",
    },
    {
        keyword: /.*/, // fallback rule
        targetChannelEnv: "STATUS_CHANNEL_ID",
    }
]