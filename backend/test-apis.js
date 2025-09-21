// Script para probar tanto REST como GraphQL APIs
const fetch = require('node-fetch');

async function testRestAPI() {
  console.log('🔥 Testing REST API...');
  
  try {
    // Test Swagger endpoint
    const swaggerResponse = await fetch('http://localhost:3000/api-json');
    if (swaggerResponse.ok) {
      console.log('✅ REST API - Swagger documentation available');
    } else {
      console.log('❌ REST API - Swagger not accessible');
    }

    // Test a simple endpoint
    const moviesResponse = await fetch('http://localhost:3000/movies');
    if (moviesResponse.ok) {
      const movies = await moviesResponse.json();
      console.log(`✅ REST API - Movies endpoint working (${movies.length} movies found)`);
    } else {
      console.log('❌ REST API - Movies endpoint failed');
    }

  } catch (error) {
    console.log('❌ REST API - Connection failed:', error.message);
  }
}

async function testGraphQLAPI() {
  console.log('\n🚀 Testing GraphQL API...');
  
  try {
    // Test GraphQL introspection query
    const introspectionQuery = {
      query: `
        query IntrospectionQuery {
          __schema {
            queryType {
              name
              fields {
                name
              }
            }
            mutationType {
              name
              fields {
                name
              }
            }
          }
        }
      `
    };

    const response = await fetch('http://localhost:3000/graphql', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(introspectionQuery)
    });

    if (response.ok) {
      const result = await response.json();
      if (result.data && result.data.__schema) {
        console.log('✅ GraphQL API - Schema introspection working');
        console.log(`✅ GraphQL API - Available queries: ${result.data.__schema.queryType.fields.map(f => f.name).join(', ')}`);
        console.log(`✅ GraphQL API - Available mutations: ${result.data.__schema.mutationType.fields.map(f => f.name).join(', ')}`);
      } else {
        console.log('❌ GraphQL API - Invalid schema response');
      }
    } else {
      console.log('❌ GraphQL API - Request failed');
    }

  } catch (error) {
    console.log('❌ GraphQL API - Connection failed:', error.message);
  }
}

async function testMoviesQuery() {
  console.log('\n📽️ Testing GraphQL Movies Query...');
  
  try {
    const moviesQuery = {
      query: `
        query GetMovies {
          movies {
            id
            title
            director
            status
            createdAt
          }
        }
      `
    };

    const response = await fetch('http://localhost:3000/graphql', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(moviesQuery)
    });

    if (response.ok) {
      const result = await response.json();
      if (result.data && result.data.movies) {
        console.log(`✅ GraphQL Movies Query - Found ${result.data.movies.length} movies`);
        if (result.data.movies.length > 0) {
          console.log(`✅ Sample movie: ${result.data.movies[0].title}`);
        }
      } else {
        console.log('❌ GraphQL Movies Query - No data returned');
      }
    } else {
      console.log('❌ GraphQL Movies Query - Request failed');
    }

  } catch (error) {
    console.log('❌ GraphQL Movies Query - Failed:', error.message);
  }
}

async function runTests() {
  console.log('🧪 API Testing Started\n');
  console.log('Testing REST + GraphQL implementation...\n');
  
  await testRestAPI();
  await testGraphQLAPI();
  await testMoviesQuery();
  
  console.log('\n✨ API Testing Completed!');
  console.log('\n📖 Access Points:');
  console.log('- REST API: http://localhost:3000');
  console.log('- GraphQL Playground: http://localhost:3000/graphql');
  console.log('- Swagger Documentation: http://localhost:3000/api');
}

// Run the tests
runTests().catch(console.error);
