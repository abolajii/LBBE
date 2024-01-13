// Function to paginate the results
const paginateResults = (results, page, limit) => {
  const startIndex = (page - 1) * limit;
  const endIndex = page * limit;
  return results.slice(startIndex, endIndex);
};

export { paginateResults };
