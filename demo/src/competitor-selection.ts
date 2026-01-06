import { XRaySDK } from "xray-sdk";

async function generateKeywordsWithLLM(product: any): Promise<string[]> {
  await new Promise((resolve) => setTimeout(resolve, 200));

  const keywords = [
    product.title.toLowerCase(),
    product.category.toLowerCase(),
    "wireless",
    "charging",
  ];

  console.log("  🤖 LLM generated keywords:", keywords);
  return keywords;
}

async function searchProductAPI(keywords: string[]): Promise<any[]> {
  await new Promise((resolve) => setTimeout(resolve, 300));

  const allProducts = [
    {
      id: 1,
      name: "iPhone Wireless Charger",
      price: 299,
      rating: 4.5,
      reviews: 1200,
      category: "Electronics",
    },
    {
      id: 2,
      name: "Samsung Fast Charger",
      price: 199,
      rating: 4.3,
      reviews: 800,
      category: "Electronics",
    },
    {
      id: 3,
      name: "Laptop Stand Aluminum",
      price: 599,
      rating: 4.7,
      reviews: 500,
      category: "Accessories",
    },
    {
      id: 4,
      name: "Phone Case Leather",
      price: 99,
      rating: 4.0,
      reviews: 300,
      category: "Accessories",
    },
    {
      id: 5,
      name: "Wireless Power Bank",
      price: 399,
      rating: 4.6,
      reviews: 950,
      category: "Electronics",
    },
    {
      id: 6,
      name: "USB-C Cable 2m",
      price: 49,
      rating: 4.2,
      reviews: 2000,
      category: "Electronics",
    },
    {
      id: 7,
      name: "Desktop Organizer",
      price: 149,
      rating: 3.9,
      reviews: 200,
      category: "Office",
    },
    {
      id: 8,
      name: "Anker Wireless Charger",
      price: 249,
      rating: 4.8,
      reviews: 3500,
      category: "Electronics",
    },
    {
      id: 9,
      name: "Belkin Charging Pad",
      price: 279,
      rating: 4.4,
      reviews: 1100,
      category: "Electronics",
    },
    {
      id: 10,
      name: "Generic Phone Holder",
      price: 89,
      rating: 3.5,
      reviews: 150,
      category: "Accessories",
    },
  ];

  const mockLargeDataset = [...allProducts];
  for (let i = 11; i <= 5000; i++) {
    mockLargeDataset.push({
      id: i,
      name: `Product ${i}`,
      price: Math.floor(Math.random() * 1000) + 50,
      rating: Math.random() * 2 + 3,
      reviews: Math.floor(Math.random() * 5000),
      category: ["Electronics", "Accessories", "Office"][
        Math.floor(Math.random() * 3)
      ],
    });
  }

  console.log(`  📡 API returned ${mockLargeDataset.length} products`);
  return mockLargeDataset;
}

async function evaluateRelevanceWithLLM(
  products: any[],
  originalProduct: any
): Promise<any[]> {
  await new Promise((resolve) => setTimeout(resolve, 500));

  const relevant = products.filter((p) => {
    if (
      p.name.toLowerCase().includes("wireless") &&
      p.name.toLowerCase().includes("charger")
    ) {
      return true;
    }

    if (p.name.toLowerCase().includes("laptop stand")) {
      return true;
    }
    return false;
  });

  console.log(
    `  🤖 LLM evaluated ${products.length} → ${relevant.length} relevant products`
  );
  return relevant;
}

function rankProducts(products: any[]): any[] {
  return products.sort((a, b) => {
    const scoreA = a.rating * Math.log(a.reviews + 1);
    const scoreB = b.rating * Math.log(b.reviews + 1);
    return scoreB - scoreA;
  });
}

async function competitorSelectionPipeline(sellerProduct: any) {
  console.log("\n🚀 Starting Competitor Selection Pipeline");
  console.log("📦 Seller Product:", sellerProduct);
  console.log("─".repeat(60));

  const xray = new XRaySDK({
    apiUrl: "http://localhost:3000/api",
    sampling: {
      keepAllOutputs: true,
      keepThresholdCandidates: 10,
      sampleRate: 0.01,
    },
  });

  const run = xray.startRun(
    "competitor_selection",
    {
      sellerProduct,
      timestamp: new Date(),
    },
    {
      userId: "seller_12345",
      marketplace: "Amazon",
    }
  );

  try {
    console.log("\n📍 Step 1: Generate Keywords (LLM)");
    const step1 = run.addStep("generate_keywords", "llm");
    step1.recordInput(sellerProduct);

    const keywords = await generateKeywordsWithLLM(sellerProduct);

    step1.recordOutput(keywords);
    step1.recordLLMDecision(
      "Generated keywords based on product title and category using GPT-4",
      keywords.length
    );

    console.log("\n📍 Step 2: Search Products (API Call)");
    const step2 = run.addStep("search_products", "api");
    step2.recordInput({ keywords });

    const allProducts = await searchProductAPI(keywords);

    step2.recordOutput({ count: allProducts.length });
    step2.recordCandidates(allProducts, "accepted");

    console.log("\n📍 Step 3: Filter by Price Range");
    const step3 = run.addStep("filter_price", "filter");

    const minPrice = sellerProduct.price * 0.7; // 70% of seller price
    const maxPrice = sellerProduct.price * 1.3; // 130% of seller price

    const priceFiltered = allProducts.filter(
      (p) => p.price >= minPrice && p.price <= maxPrice
    );

    step3.recordFiltering(allProducts, priceFiltered, "price_range", "range", {
      minPrice,
      maxPrice,
    });

    console.log(
      `  ✅ Filtered ${allProducts.length} → ${priceFiltered.length} products (price: ₹${minPrice}-₹${maxPrice})`
    );

    console.log("\n📍 Step 4: Filter by Rating");
    const step4 = run.addStep("filter_rating", "filter");

    const minRating = 4.0;
    const ratingFiltered = priceFiltered.filter((p) => p.rating >= minRating);

    step4.recordFiltering(
      priceFiltered,
      ratingFiltered,
      "minimum_rating",
      "threshold",
      { minRating }
    );

    console.log(
      `  ✅ Filtered ${priceFiltered.length} → ${ratingFiltered.length} products (rating ≥ ${minRating})`
    );

    console.log("\n📍 Step 5: Filter by Category");
    const step5 = run.addStep("filter_category", "filter");

    const categoryFiltered = ratingFiltered.filter(
      (p) => p.category === sellerProduct.category
    );

    step5.recordFiltering(
      ratingFiltered,
      categoryFiltered,
      "category_match",
      "filter",
      { requiredCategory: sellerProduct.category }
    );

    console.log(
      `  ✅ Filtered ${ratingFiltered.length} → ${categoryFiltered.length} products (category: ${sellerProduct.category})`
    );

    console.log("\n📍 Step 6: LLM Relevance Evaluation");
    const step6 = run.addStep("llm_relevance_check", "llm");
    step6.recordInput({ candidates: categoryFiltered.length });

    const relevantProducts = await evaluateRelevanceWithLLM(
      categoryFiltered,
      sellerProduct
    );

    step6.recordFiltering(
      categoryFiltered,
      relevantProducts,
      "llm_relevance",
      "llm_eval",
      { model: "gpt-4", prompt: "Filter products similar to seller product" }
    );
    step6.recordLLMDecision(
      "Evaluated product relevance using semantic similarity. Kept products with high relevance scores.",
      relevantProducts.length
    );

    console.log("\n📍 Step 7: Rank Products");
    const step7 = run.addStep("rank_products", "rank");
    step7.recordInput({ candidates: relevantProducts });

    const rankedProducts = rankProducts(relevantProducts);

    step7.recordOutput(rankedProducts);
    step7.setMetadata({
      rankingAlgorithm: "rating * log(reviews + 1)",
      topScore: rankedProducts[0]
        ? rankedProducts[0].rating * Math.log(rankedProducts[0].reviews + 1)
        : 0,
    });

    console.log(`  ✅ Ranked ${rankedProducts.length} products`);

    const bestCompetitor = rankedProducts[0];

    console.log("\n─".repeat(60));
    console.log("🎯 FINAL RESULT:");
    console.log("  Best Competitor:", bestCompetitor);
    console.log("─".repeat(60));

    await run.complete({
      selectedCompetitor: bestCompetitor,
      totalCandidatesEvaluated: allProducts.length,
      finalCandidates: rankedProducts.length,
    });

    console.log("\n✅ X-Ray trace sent to API");
    console.log(`📊 View trace: http://localhost:3000/api/runs/${run.id}`);

    return bestCompetitor;
  } catch (error) {
    console.error("\n❌ Pipeline failed:", error);
    await run.fail(error as Error);
    throw error;
  }
}

// Run the demo
async function main() {
  const sellerProduct = {
    title: "iPhone 15 Wireless Charging Pad",
    price: 299,
    category: "Electronics",
    rating: 4.5,
    reviews: 1500,
  };

  try {
    await competitorSelectionPipeline(sellerProduct);

    console.log("\n🔍 DEBUGGING SCENARIO:");
    console.log(
      '   The selected competitor might be "Laptop Stand Aluminum" (BAD MATCH!)'
    );
    console.log("   This is intentional to demonstrate X-Ray debugging.");
    console.log("\n   To debug:");
    console.log("   1. Query the API to get the run details");
    console.log("   2. Look at Step 6 (LLM Relevance Check)");
    console.log("   3. See which products were accepted vs rejected");
    console.log('   4. Find that the LLM incorrectly kept "Laptop Stand"');
  } catch (error) {
    console.error("Demo failed:", error);
  }
}

main();
