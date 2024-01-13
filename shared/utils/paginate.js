const paginate = async (items, page = 1, limit = 10) => {
  try {
    const startIndex = (page - 1) * limit;
    const slicedItems = items.slice(startIndex, startIndex + limit);

    const totalItems = items.length;
    const totalPages = Math.ceil(totalItems / limit);
    const hasNext = startIndex + limit < totalItems;
    const hasPrev = page > 1;
    const itemsInPage = slicedItems.length;

    const paginationInfo = {
      totalItems,
      totalPages,
      currentPage: page,
      hasNext,
      hasPrev,
      itemsInPage,
    };

    return {
      paginationInfo,
      items: slicedItems,
    };
  } catch (error) {
    throw error;
  }
};

module.exports = { paginate };
