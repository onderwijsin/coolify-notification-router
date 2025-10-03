export default [
    {
        keyword: /\bdeploy\w*\b/i,
        targetChannelEnv: "DEPLOYMENTS_CHANNEL_ID",
    },
    {
        keyword: /.*/, // fallback rule
        targetChannelEnv: "STATUS_CHANNEL_ID",
    }
]