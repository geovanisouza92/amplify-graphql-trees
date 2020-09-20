/* Amplify Params - DO NOT EDIT
  API_BRANCHES_GRAPHQLAPIENDPOINTOUTPUT
  API_BRANCHES_GRAPHQLAPIIDOUTPUT
  API_BRANCHES_GRAPHQLAPIKEYOUTPUT
Amplify Params - DO NOT EDIT */

const axios = require('axios');
const gql = require('graphql-tag');
const graphql = require('graphql');
const { print } = graphql;

const graphqlRequest = async (data) => {
  const res = await axios({
    url: process.env.API_BRANCHES_GRAPHQLAPIENDPOINTOUTPUT,
    method: 'post',
    headers: { 'x-api-key': process.env.API_BRANCHES_GRAPHQLAPIKEYOUTPUT },
    data,
  });
  return res.data;
};

const createBranchMutation = gql`
  mutation CreateBranch($name: String!) {
    createBranch(input: { name: $name }) {
      id
      name
    }
  }
`;

const createBranchTreeMutation = gql`
  mutation CreateBranchTree($ancestorID: ID!, $descendantID: ID!) {
    createBranchTree(input: {ancestorID: $ancestorID, descendantID: $descendantID}) {
      id
      ancestorID
      descendantID
    }
  }
`;

const listBranchAncestorsQuery = gql`
  query ListBranchAncestors($id: ID!) {
    listBranchTrees(filter: {descendantID: {eq: $id}}) {
      items {
        id
        ancestorID
      }
    }
  }
`;

// TODO listBranchTrees instead getBranch
const getBranchLinksQuery = gql`
  query GetBranchLinks($id: ID!) {
    branch: getBranch(id: $id) {
      descendants {
        items {
          id
          descendant {
            ancestors {
              items {
                id
              }
            }
          }
        }
      }
    }
  }
`;

const deleteBranchTreeMutation = gql`
  mutation DeleteBranchTree($id: ID!) {
    deleteBranchTree(input: {id: $id}) {
      id
    }
  }
`;

const listBranchLinksQuery = gql`
  query Q($branchID: ID!, $newAncestorID: ID!) {
    branch: getBranch(id: $branchID) {
      id
      # name
      ancestors(filter: {ancestorID: {ne: $branchID}}) {
        items {
          id
          ancestor {
            id
            # name
          }
        }
      }
      descendants(filter: {descendantID: {ne: $branchID}}) {
        items {
          id
          descendant {
            id
            # name
            ancestors(filter: {ancestorID: {ne: $branchID}}) {
              items {
                id
                ancestor {
                  id
                  # name
                }
              }
            }
          }
        }
      }
    }
    newAncestor: getBranch(id: $newAncestorID) {
      id
      # name
      ancestors(filter: {ancestorID: {ne: $newAncestorID}}) {
        items {
          id
          ancestor {
            id
            # name
          }
        }
      }
    }
  }
`;

const resolvers = {
  Mutation: {
    createBranchWithLinks: async ({ arguments }) => {
      const { data: { createBranch: branch } } = await graphqlRequest({
        query: print(createBranchMutation),
        variables: {
          name: arguments.name,
        },
      });

      const linkRequests = [
        {
          query: print(createBranchTreeMutation),
          variables: {
            ancestorID: branch.id,
            descendantID: branch.id,
          },
        },
      ];

      if (arguments.ancestorID) {
        const { data: { listBranchTrees: { items: ancestors } } } = await graphqlRequest({
          query: print(listBranchAncestorsQuery),
          variables: {
            id: arguments.ancestorID,
          },
        });

        ancestors.forEach(({ ancestorID }) => {
          linkRequests.push({
            query: print(createBranchTreeMutation),
            variables: {
              ancestorID,
              descendantID: branch.id,
            },
          });
        })
      }

      await Promise.all(linkRequests.map(async (request) => {
        return graphqlRequest(request);
      }));

      return branch;
    },
    unlinkBranch: async ({ arguments }) => {
      const { data: { branch } } = await graphqlRequest({
        query: print(getBranchLinksQuery),
        variables: {
          id: arguments.id,
        },
      });

      const toRemove = new Set();
      branch.descendants.items.forEach((descendant) => {
        toRemove.add(descendant.id);
        descendant.descendant.ancestors.items.forEach((ancestor) => {
          toRemove.add(ancestor.id);
        });
      });

      const requests = [];
      toRemove.forEach((id) => {
        requests.push({
          query: print(deleteBranchTreeMutation),
          variables: { id },
        });
      });

      return Promise.all(requests.map(async (request) => {
        const { data } = await graphqlRequest(request);
        return data.deleteBranchTree;
      }));
    },
    moveBranch: async ({ arguments }) => {
      const { data: { branch, newAncestor } } = await graphqlRequest({
        query: print(listBranchLinksQuery),
        variables: {
          branchID: arguments.branchID,
          newAncestorID: arguments.newAncestorID,
        },
      });

      const toRemove = new Map();
      const toAdd = new Map();

      branch.ancestors.items.forEach((node) => {
        toRemove.set(`${node.ancestor.id} + ${branch.id}`, node.id);
      });
      branch.descendants.items.forEach(({ descendant }) => {
        descendant.ancestors.items.forEach((descendantAncestor) => {
          if (descendantAncestor.ancestor.id === descendant.id) return; // Skip self-link ancestor
          toRemove.set(`${descendantAncestor.ancestor.id} + ${descendant.id}`, descendantAncestor.id);
        });
      });
      const newAncestors = [newAncestor].concat(newAncestor.ancestors.items.map(({ ancestor }) => ancestor));
      const nodesToLink = [branch].concat(branch.descendants.items.map(({ descendant }) => descendant));
      nodesToLink.forEach((node) => {
        newAncestors.forEach((ancestor) => {
          const key = `${ancestor.id} + ${node.id}`;
          if (toRemove.has(key)) {
            toRemove.delete(key); // Cancel deletion from one of new ancestors to node
            return;
          }
          toAdd.set(key, [ancestor.id, node.id]);
        });
      });

      const requests = [];
      for (const [_key, id] of toRemove.entries()) {
        requests.push({
          query: print(deleteBranchTreeMutation),
          variables: {
            id: id,
          },
        });
      }
      for (const [_key, [ancestorID, descendantID]] of toAdd.entries()) {
        requests.push({
          query: print(createBranchTreeMutation),
          variables: {
            ancestorID,
            descendantID,
          },
        });
      }
      await Promise.all(requests.map((request) => graphqlRequest(request)));
      return branch;
    },
  },
};

exports.handler = async (event) => {
  console.log(JSON.stringify(event, null, '\t'));
  const typeHandler = resolvers[event.typeName];
  if (typeHandler) {
    const resolver = typeHandler[event.fieldName];
    if (resolver) {
      return resolver(event);
    }
  }
  throw new Error(`Resolver not found for typeName "${event.typeName}.${event.fieldName}"`);
};
