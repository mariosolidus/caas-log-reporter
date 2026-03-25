const RAILWAY_API_URL = 'https://backboard.railway.app/graphql/v2';
const PROJECT_ID = process.env.RAILWAY_PROJECT_ID || '369a7aa0-a3a0-4d79-9768-8dc7e5207319';

async function railwayQuery(query, variables = {}) {
  const response = await fetch(RAILWAY_API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${process.env.RAILWAY_API_TOKEN}`,
    },
    body: JSON.stringify({ query, variables }),
  });
  if (!response.ok) throw new Error(`Railway API HTTP error: ${response.status}`);
  const data = await response.json();
  if (data.errors) throw new Error(data.errors.map((e) => e.message).join(', '));
  return data.data;
}

async function getProjectInfo() {
  const query = `
    query GetProject($id: String!) {
      project(id: $id) {
        id name
        environments { edges { node { id name } } }
        services { edges { node { id name } } }
      }
    }
  `;
  return (await railwayQuery(query, { id: PROJECT_ID })).project;
}

async function getLatestDeploymentId(serviceId, environmentId) {
  const query = `
    query GetDeployments($serviceId: String!, $environmentId: String!) {
      deployments(input: { serviceId: $serviceId, environmentId: $environmentId }) {
        edges { node { id status createdAt } }
      }
    }
  `;
  const data = await railwayQuery(query, { serviceId, environmentId });
  const edges = data.deployments?.edges || [];
  const active = edges.find((e) => ['SUCCESS', 'ACTIVE'].includes(e.node.status));
  return (active || edges[0])?.node?.id || null;
}

async function getLogsForDeployment(deploymentId, startDate, endDate) {
  const query = `
    query GetLogs($deploymentId: String!, $startDate: String, $endDate: String) {
      deploymentLogs(deploymentId: $deploymentId, startDate: $startDate, endDate: $endDate, limit: 2000) {
        timestamp message severity
      }
    }
  `;
  const data = await railwayQuery(query, {
    deploymentId,
    startDate: startDate.toISOString(),
    endDate: endDate.toISOString(),
  });
  return data.deploymentLogs || [];
}

async function fetchAllLogs(startDate, endDate) {
  console.log(`Fetching logs ${startDate.toISOString()} -> ${endDate.toISOString()}`);
  const project = await getProjectInfo();
  const environments = project.environments.edges.map((e) => e.node);
  const prodEnv = environments.find((e) => e.name.toLowerCase() === 'production') || environments[0];
  if (!prodEnv) throw new Error('No environment found');
  const services = project.services.edges.map((e) => e.node);
  const result = {};
  for (const service of services) {
    console.log(`  Fetching: ${service.name}`);
    try {
      const deploymentId = await getLatestDeploymentId(service.id, prodEnv.id);
      if (!deploymentId) { result[service.name] = []; continue; }
      const logs = await getLogsForDeployment(deploymentId, startDate, endDate);
      result[service.name] = logs;
      console.log(`    -> ${logs.length} lines`);
    } catch (err) {
      console.error(`    -> Error for ${service.name}: ${err.message}`);
      result[service.name] = [];
    }
  }
  return { projectName: project.name, services: result };
}

module.exports = { fetchAllLogs };
