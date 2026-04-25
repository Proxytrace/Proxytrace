-- Agent 1: Customer Support Agent (gpt-4o / openai)
-- Tools: check_inventory, lookup_order, process_refund
-- Fingerprint generated with: python3 scripts/compute_fingerprint.py --agent customer_support

INSERT INTO AgentEntity (Id, Project, SystemMessage, Tools, Model, Provider, Fingerprint, CreatedAt, UpdatedAt)
VALUES (
  '10000000-0000-0000-0000-000000000000',
  '00000000-0000-0000-0000-000000000003',
  '{"Contents":[{"Text":"You are a helpful customer support agent for TechShop, an online electronics retailer. Help customers with order tracking, refunds, and product availability. Always be professional, empathetic, and solution-focused."}]}',
  '[{"Name":"check_inventory","Description":"Check the current inventory level for a product. Returns stock count and next restock date if applicable.","Arguments":{"type":"object","properties":{"product_id":{"type":"string","description":"The product ID to check inventory for"}},"required":["product_id"]}},{"Name":"lookup_order","Description":"Look up an order by its ID and return its current status, shipping information, and estimated delivery date.","Arguments":{"type":"object","properties":{"order_id":{"type":"string","description":"The order ID to look up"}},"required":["order_id"]}},{"Name":"process_refund","Description":"Process a refund for a given order. Returns a confirmation number and the expected processing time in business days.","Arguments":{"type":"object","properties":{"order_id":{"type":"string","description":"The order ID to refund"},"reason":{"type":"string","description":"The reason for the refund"}},"required":["order_id","reason"]}}]',
  'gpt-4o',
  'openai',
  '0b24227378957a5d06db9528ca5b7b189af3e870f2f7b54da4ff72603e724bad',
  '2026-03-01T08:00:00.0000000+00:00',
  '2026-03-01T08:00:00.0000000+00:00'
);

-- ── Agent Calls (Traces) ──────────────────────────────────────────────────────

-- Trace 1: Return policy question (no tool call)
INSERT INTO AgentCallEntity (Id, AgentId, Model, Provider, Request, Response, InputTokens, OutputTokens, DurationMs, HttpStatus, FinishReason, ErrorMessage, CreatedAt, UpdatedAt) VALUES (
  '11000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000000', 'gpt-4o', 'openai',
  '{"Id":"cc100000-0000-0000-0000-000000000001","Messages":[{"Role":"User","Contents":[{"Text":"What is your return policy for electronics?"}]},{"Role":"Assistant","ToolRequests":[],"Contents":[{"Text":"Our return policy allows returns within 30 days of purchase for most electronics. Items must be in original condition with all accessories and packaging included. Refunds are processed within 3-5 business days. Some items like opened software or personalised products may not be eligible. Is there a specific item you are looking to return?"}]}]}',
  '{"ToolRequests":[],"Contents":[{"Text":"Our return policy allows returns within 30 days of purchase for most electronics. Items must be in original condition with all accessories and packaging included. Refunds are processed within 3-5 business days. Some items like opened software or personalised products may not be eligible. Is there a specific item you are looking to return?"}]}',
  245, 87, 920, 200, 'stop', NULL, '2026-03-01T09:15:00.0000000+00:00', '2026-03-01T09:15:00.0000000+00:00'
);

-- Trace 2: Order status — shipped (uses lookup_order)
INSERT INTO AgentCallEntity (Id, AgentId, Model, Provider, Request, Response, InputTokens, OutputTokens, DurationMs, HttpStatus, FinishReason, ErrorMessage, CreatedAt, UpdatedAt) VALUES (
  '11000000-0000-0000-0000-000000000002', '10000000-0000-0000-0000-000000000000', 'gpt-4o', 'openai',
  '{"Id":"cc100000-0000-0000-0000-000000000002","Messages":[{"Role":"User","Contents":[{"Text":"Where is my order ORD-10234? I placed it five days ago."}]},{"Role":"Assistant","ToolRequests":[{"Id":"call_a01","Name":"lookup_order","Arguments":"{"order_id":"ORD-10234"}"}],"Contents":[]},{"Role":"Tool","Id":"call_a01","Contents":[{"Text":"call_a01"},{"Text":"Status: Shipped. Carrier: UPS. Tracking: 1Z999AA10123456784. Estimated delivery: March 5, 2026."}]},{"Role":"Assistant","ToolRequests":[],"Contents":[{"Text":"Great news! Your order ORD-10234 has been shipped via UPS with tracking number 1Z999AA10123456784. It is estimated to arrive on March 5, 2026. You can track it directly on the UPS website using that number. Is there anything else I can help you with?"}]}]}',
  '{"ToolRequests":[],"Contents":[{"Text":"Great news! Your order ORD-10234 has been shipped via UPS with tracking number 1Z999AA10123456784. It is estimated to arrive on March 5, 2026. You can track it directly on the UPS website using that number. Is there anything else I can help you with?"}]}',
  387, 124, 1420, 200, 'stop', NULL, '2026-03-02T10:22:00.0000000+00:00', '2026-03-02T10:22:00.0000000+00:00'
);

-- Trace 3: Order status — in transit (uses lookup_order)
INSERT INTO AgentCallEntity (Id, AgentId, Model, Provider, Request, Response, InputTokens, OutputTokens, DurationMs, HttpStatus, FinishReason, ErrorMessage, CreatedAt, UpdatedAt) VALUES (
  '11000000-0000-0000-0000-000000000003', '10000000-0000-0000-0000-000000000000', 'gpt-4o', 'openai',
  '{"Id":"cc100000-0000-0000-0000-000000000003","Messages":[{"Role":"User","Contents":[{"Text":"Can you check on order ORD-10567 for me?"}]},{"Role":"Assistant","ToolRequests":[{"Id":"call_a02","Name":"lookup_order","Arguments":"{"order_id":"ORD-10567"}"}],"Contents":[]},{"Role":"Tool","Id":"call_a02","Contents":[{"Text":"call_a02"},{"Text":"Status: In transit. Carrier: FedEx. Last scan: Chicago distribution centre. Estimated delivery: March 6, 2026."}]},{"Role":"Assistant","ToolRequests":[],"Contents":[{"Text":"Your order ORD-10567 is currently in transit with FedEx. It was last scanned at the Chicago distribution centre and is estimated to arrive on March 6, 2026. Please allow a bit more time if there are any weather delays in your area. Is there anything else I can help you with?"}]}]}',
  '{"ToolRequests":[],"Contents":[{"Text":"Your order ORD-10567 is currently in transit with FedEx. It was last scanned at the Chicago distribution centre and is estimated to arrive on March 6, 2026. Please allow a bit more time if there are any weather delays in your area. Is there anything else I can help you with?"}]}',
  401, 118, 1380, 200, 'stop', NULL, '2026-03-03T11:05:00.0000000+00:00', '2026-03-03T11:05:00.0000000+00:00'
);

-- Trace 4: Order status — delivered (uses lookup_order)
INSERT INTO AgentCallEntity (Id, AgentId, Model, Provider, Request, Response, InputTokens, OutputTokens, DurationMs, HttpStatus, FinishReason, ErrorMessage, CreatedAt, UpdatedAt) VALUES (
  '11000000-0000-0000-0000-000000000004', '10000000-0000-0000-0000-000000000000', 'gpt-4o', 'openai',
  '{"Id":"cc100000-0000-0000-0000-000000000004","Messages":[{"Role":"User","Contents":[{"Text":"I think my order ORD-10891 should have arrived by now, can you check?"}]},{"Role":"Assistant","ToolRequests":[{"Id":"call_a03","Name":"lookup_order","Arguments":"{"order_id":"ORD-10891"}"}],"Contents":[]},{"Role":"Tool","Id":"call_a03","Contents":[{"Text":"call_a03"},{"Text":"Status: Delivered. Delivered on: March 1, 2026 at 2:34 PM. Signed by: J. SMITH."}]},{"Role":"Assistant","ToolRequests":[],"Contents":[{"Text":"According to our records, your order ORD-10891 was delivered on March 1, 2026 at 2:34 PM and was signed for by J. Smith. If you did not receive it, please check with neighbours or any secure delivery locations. If the package is still missing, I can help you open a missing parcel investigation."}]}]}',
  '{"ToolRequests":[],"Contents":[{"Text":"According to our records, your order ORD-10891 was delivered on March 1, 2026 at 2:34 PM and was signed for by J. Smith. If you did not receive it, please check with neighbours or any secure delivery locations. If the package is still missing, I can help you open a missing parcel investigation."}]}',
  412, 131, 1510, 200, 'stop', NULL, '2026-03-03T14:30:00.0000000+00:00', '2026-03-03T14:30:00.0000000+00:00'
);

-- Trace 5: Order status — still processing (uses lookup_order)
INSERT INTO AgentCallEntity (Id, AgentId, Model, Provider, Request, Response, InputTokens, OutputTokens, DurationMs, HttpStatus, FinishReason, ErrorMessage, CreatedAt, UpdatedAt) VALUES (
  '11000000-0000-0000-0000-000000000005', '10000000-0000-0000-0000-000000000000', 'gpt-4o', 'openai',
  '{"Id":"cc100000-0000-0000-0000-000000000005","Messages":[{"Role":"User","Contents":[{"Text":"I just placed order ORD-10012 an hour ago. Is it confirmed?"}]},{"Role":"Assistant","ToolRequests":[{"Id":"call_a04","Name":"lookup_order","Arguments":"{"order_id":"ORD-10012"}"}],"Contents":[]},{"Role":"Tool","Id":"call_a04","Contents":[{"Text":"call_a04"},{"Text":"Status: Processing. Payment confirmed. Expected to dispatch within 24 hours."}]},{"Role":"Assistant","ToolRequests":[],"Contents":[{"Text":"Your order ORD-10012 has been confirmed and payment has been received. It is currently being processed in our warehouse and is expected to be dispatched within 24 hours. You will receive a shipping confirmation email with tracking details once it has been picked up by the carrier."}]}]}',
  '{"ToolRequests":[],"Contents":[{"Text":"Your order ORD-10012 has been confirmed and payment has been received. It is currently being processed in our warehouse and is expected to be dispatched within 24 hours. You will receive a shipping confirmation email with tracking details once it has been picked up by the carrier."}]}',
  378, 109, 1250, 200, 'stop', NULL, '2026-03-04T08:45:00.0000000+00:00', '2026-03-04T08:45:00.0000000+00:00'
);

-- Trace 6: Order status — delayed (uses lookup_order)
INSERT INTO AgentCallEntity (Id, AgentId, Model, Provider, Request, Response, InputTokens, OutputTokens, DurationMs, HttpStatus, FinishReason, ErrorMessage, CreatedAt, UpdatedAt) VALUES (
  '11000000-0000-0000-0000-000000000006', '10000000-0000-0000-0000-000000000000', 'gpt-4o', 'openai',
  '{"Id":"cc100000-0000-0000-0000-000000000006","Messages":[{"Role":"User","Contents":[{"Text":"My order ORD-10345 was supposed to arrive yesterday. What happened?"}]},{"Role":"Assistant","ToolRequests":[{"Id":"call_a05","Name":"lookup_order","Arguments":"{"order_id":"ORD-10345"}"}],"Contents":[]},{"Role":"Tool","Id":"call_a05","Contents":[{"Text":"call_a05"},{"Text":"Status: Delayed. Reason: Severe weather conditions in the Midwest. New estimated delivery: March 7, 2026. Carrier: UPS."}]},{"Role":"Assistant","ToolRequests":[],"Contents":[{"Text":"I apologise for the delay with your order ORD-10345. Unfortunately, UPS has reported severe weather conditions in the Midwest that are affecting deliveries in the region. Your new estimated delivery date is March 7, 2026. I am sorry for the inconvenience this causes. Would you like me to arrange compensation for the delay?"}]}]}',
  '{"ToolRequests":[],"Contents":[{"Text":"I apologise for the delay with your order ORD-10345. Unfortunately, UPS has reported severe weather conditions in the Midwest that are affecting deliveries in the region. Your new estimated delivery date is March 7, 2026. I am sorry for the inconvenience this causes. Would you like me to arrange compensation for the delay?"}]}',
  419, 136, 1590, 200, 'stop', NULL, '2026-03-05T13:12:00.0000000+00:00', '2026-03-05T13:12:00.0000000+00:00'
);

-- Trace 7: Inventory check — iPhone in stock (uses check_inventory)
INSERT INTO AgentCallEntity (Id, AgentId, Model, Provider, Request, Response, InputTokens, OutputTokens, DurationMs, HttpStatus, FinishReason, ErrorMessage, CreatedAt, UpdatedAt) VALUES (
  '11000000-0000-0000-0000-000000000007', '10000000-0000-0000-0000-000000000000', 'gpt-4o', 'openai',
  '{"Id":"cc100000-0000-0000-0000-000000000007","Messages":[{"Role":"User","Contents":[{"Text":"Do you have the iPhone 15 Pro Max 256GB in Natural Titanium in stock? Product ID is PRD-4521."}]},{"Role":"Assistant","ToolRequests":[{"Id":"call_a06","Name":"check_inventory","Arguments":"{"product_id":"PRD-4521"}"}],"Contents":[]},{"Role":"Tool","Id":"call_a06","Contents":[{"Text":"call_a06"},{"Text":"In stock: 47 units. No restock pending."}]},{"Role":"Assistant","ToolRequests":[],"Contents":[{"Text":"Great news! The iPhone 15 Pro Max 256GB in Natural Titanium (PRD-4521) is currently in stock with 47 units available. You can add it to your cart and proceed to checkout right away. Is there anything else I can help you with?"}]}]}',
  '{"ToolRequests":[],"Contents":[{"Text":"Great news! The iPhone 15 Pro Max 256GB in Natural Titanium (PRD-4521) is currently in stock with 47 units available. You can add it to your cart and proceed to checkout right away. Is there anything else I can help you with?"}]}',
  392, 98, 1180, 200, 'stop', NULL, '2026-03-05T15:30:00.0000000+00:00', '2026-03-05T15:30:00.0000000+00:00'
);

-- Trace 8: Inventory check — MacBook out of stock (uses check_inventory)
INSERT INTO AgentCallEntity (Id, AgentId, Model, Provider, Request, Response, InputTokens, OutputTokens, DurationMs, HttpStatus, FinishReason, ErrorMessage, CreatedAt, UpdatedAt) VALUES (
  '11000000-0000-0000-0000-000000000008', '10000000-0000-0000-0000-000000000000', 'gpt-4o', 'openai',
  '{"Id":"cc100000-0000-0000-0000-000000000008","Messages":[{"Role":"User","Contents":[{"Text":"Is the MacBook Pro 14-inch M3 with 1TB storage available? Its PRD-7834."}]},{"Role":"Assistant","ToolRequests":[{"Id":"call_a07","Name":"check_inventory","Arguments":"{"product_id":"PRD-7834"}"}],"Contents":[]},{"Role":"Tool","Id":"call_a07","Contents":[{"Text":"call_a07"},{"Text":"Out of stock. Next restock: estimated March 18, 2026."}]},{"Role":"Assistant","ToolRequests":[],"Contents":[{"Text":"I am sorry, the MacBook Pro 14-inch M3 with 1TB storage (PRD-7834) is currently out of stock. We are expecting a restock around March 18, 2026. I can add you to our notification list so you receive an email the moment it becomes available. Would you like me to do that?"}]}]}',
  '{"ToolRequests":[],"Contents":[{"Text":"I am sorry, the MacBook Pro 14-inch M3 with 1TB storage (PRD-7834) is currently out of stock. We are expecting a restock around March 18, 2026. I can add you to our notification list so you receive an email the moment it becomes available. Would you like me to do that?"}]}',
  398, 111, 1340, 200, 'stop', NULL, '2026-03-06T10:00:00.0000000+00:00', '2026-03-06T10:00:00.0000000+00:00'
);

-- Trace 9: Inventory check — AirPods limited stock (uses check_inventory)
INSERT INTO AgentCallEntity (Id, AgentId, Model, Provider, Request, Response, InputTokens, OutputTokens, DurationMs, HttpStatus, FinishReason, ErrorMessage, CreatedAt, UpdatedAt) VALUES (
  '11000000-0000-0000-0000-000000000009', '10000000-0000-0000-0000-000000000000', 'gpt-4o', 'openai',
  '{"Id":"cc100000-0000-0000-0000-000000000009","Messages":[{"Role":"User","Contents":[{"Text":"Quick question — do you have AirPods Pro 2nd gen in stock? PRD-2290."}]},{"Role":"Assistant","ToolRequests":[{"Id":"call_a08","Name":"check_inventory","Arguments":"{"product_id":"PRD-2290"}"}],"Contents":[]},{"Role":"Tool","Id":"call_a08","Contents":[{"Text":"call_a08"},{"Text":"In stock: 3 units. Low stock warning. Next restock: March 10, 2026."}]},{"Role":"Assistant","ToolRequests":[],"Contents":[{"Text":"The AirPods Pro 2nd Generation (PRD-2290) is available but we only have 3 units remaining — so stock is very limited. I would recommend ordering soon to secure one. A restock is expected around March 10, 2026, but current units may sell out before then. Shall I help you place an order?"}]}]}',
  '{"ToolRequests":[],"Contents":[{"Text":"The AirPods Pro 2nd Generation (PRD-2290) is available but we only have 3 units remaining — so stock is very limited. I would recommend ordering soon to secure one. A restock is expected around March 10, 2026, but current units may sell out before then. Shall I help you place an order?"}]}',
  389, 117, 1290, 200, 'stop', NULL, '2026-03-07T09:20:00.0000000+00:00', '2026-03-07T09:20:00.0000000+00:00'
);

-- Trace 10: Refund approved — item not as described (uses lookup_order + process_refund)
INSERT INTO AgentCallEntity (Id, AgentId, Model, Provider, Request, Response, InputTokens, OutputTokens, DurationMs, HttpStatus, FinishReason, ErrorMessage, CreatedAt, UpdatedAt) VALUES (
  '11000000-0000-0000-0000-000000000010', '10000000-0000-0000-0000-000000000000', 'gpt-4o', 'openai',
  '{"Id":"cc100000-0000-0000-0000-000000000010","Messages":[{"Role":"User","Contents":[{"Text":"I need to return and get a refund for order ORD-10234. The laptop screen has dead pixels. It is not what was advertised."}]},{"Role":"Assistant","ToolRequests":[{"Id":"call_b01","Name":"lookup_order","Arguments":"{"order_id":"ORD-10234"}"}],"Contents":[]},{"Role":"Tool","Id":"call_b01","Contents":[{"Text":"call_b01"},{"Text":"Status: Delivered. Ordered: February 25, 2026. Item: MacBook Air M2 13-inch. Eligible for refund: Yes (within 30-day window)."}]},{"Role":"Assistant","ToolRequests":[{"Id":"call_b02","Name":"process_refund","Arguments":"{"order_id":"ORD-10234","reason":"Item not as described - screen has dead pixels"}"}],"Contents":[]},{"Role":"Tool","Id":"call_b02","Contents":[{"Text":"call_b02"},{"Text":"Refund approved. Confirmation: REF-88123. Amount: $1,299.00. Processing time: 3-5 business days. Return label: emailed to customer."}]},{"Role":"Assistant","ToolRequests":[],"Contents":[{"Text":"I am sorry to hear about the display issue with your MacBook Air. Your refund has been approved. Here are the details: Confirmation number REF-88123, Amount $1,299.00, which will be returned to your original payment method within 3-5 business days. A prepaid return label has been sent to your email. Please use it to send the laptop back at no cost to you. Is there anything else I can help you with?"}]}]}',
  '{"ToolRequests":[],"Contents":[{"Text":"I am sorry to hear about the display issue with your MacBook Air. Your refund has been approved. Here are the details: Confirmation number REF-88123, Amount $1,299.00, which will be returned to your original payment method within 3-5 business days. A prepaid return label has been sent to your email. Please use it to send the laptop back at no cost to you. Is there anything else I can help you with?"}]}',
  621, 168, 2340, 200, 'stop', NULL, '2026-03-08T11:40:00.0000000+00:00', '2026-03-08T11:40:00.0000000+00:00'
);

-- Trace 11: Refund approved — arrived damaged (uses lookup_order + process_refund)
INSERT INTO AgentCallEntity (Id, AgentId, Model, Provider, Request, Response, InputTokens, OutputTokens, DurationMs, HttpStatus, FinishReason, ErrorMessage, CreatedAt, UpdatedAt) VALUES (
  '11000000-0000-0000-0000-000000000011', '10000000-0000-0000-0000-000000000000', 'gpt-4o', 'openai',
  '{"Id":"cc100000-0000-0000-0000-000000000011","Messages":[{"Role":"User","Contents":[{"Text":"My TV arrived with a cracked screen. Order ORD-10567. I need a full refund."}]},{"Role":"Assistant","ToolRequests":[{"Id":"call_c01","Name":"lookup_order","Arguments":"{"order_id":"ORD-10567"}"}],"Contents":[]},{"Role":"Tool","Id":"call_c01","Contents":[{"Text":"call_c01"},{"Text":"Status: Delivered. Ordered: February 28, 2026. Item: Samsung 65-inch QLED TV. Eligible for refund: Yes (within 30-day window)."}]},{"Role":"Assistant","ToolRequests":[{"Id":"call_c02","Name":"process_refund","Arguments":"{"order_id":"ORD-10567","reason":"Item arrived damaged - cracked screen"}"}],"Contents":[]},{"Role":"Tool","Id":"call_c02","Contents":[{"Text":"call_c02"},{"Text":"Refund approved. Confirmation: REF-88456. Amount: $1,799.00. Processing time: 3-5 business days. Courier collection scheduled for next business day."}]},{"Role":"Assistant","ToolRequests":[],"Contents":[{"Text":"I am very sorry that your TV arrived damaged — that is completely unacceptable and I have prioritised your refund. Your full refund of $1,799.00 has been approved (ref REF-88456) and will be credited within 3-5 business days. A courier will collect the damaged TV from your address on the next business day at no cost to you. You do not need to repackage it specially — just have it ready for collection. Is there anything else I can help you with?"}]}]}',
  '{"ToolRequests":[],"Contents":[{"Text":"I am very sorry that your TV arrived damaged — that is completely unacceptable and I have prioritised your refund. Your full refund of $1,799.00 has been approved (ref REF-88456) and will be credited within 3-5 business days. A courier will collect the damaged TV from your address on the next business day at no cost to you. You do not need to repackage it specially — just have it ready for collection. Is there anything else I can help you with?"}]}',
  638, 172, 2490, 200, 'stop', NULL, '2026-03-09T14:55:00.0000000+00:00', '2026-03-09T14:55:00.0000000+00:00'
);

-- Trace 12: Refund denied — outside return window (uses lookup_order)
INSERT INTO AgentCallEntity (Id, AgentId, Model, Provider, Request, Response, InputTokens, OutputTokens, DurationMs, HttpStatus, FinishReason, ErrorMessage, CreatedAt, UpdatedAt) VALUES (
  '11000000-0000-0000-0000-000000000012', '10000000-0000-0000-0000-000000000000', 'gpt-4o', 'openai',
  '{"Id":"cc100000-0000-0000-0000-000000000012","Messages":[{"Role":"User","Contents":[{"Text":"I want to return my headphones from order ORD-9500. I bought them in January."}]},{"Role":"Assistant","ToolRequests":[{"Id":"call_d01","Name":"lookup_order","Arguments":"{"order_id":"ORD-9500"}"}],"Contents":[]},{"Role":"Tool","Id":"call_d01","Contents":[{"Text":"call_d01"},{"Text":"Status: Delivered. Ordered: January 18, 2026. Delivered: January 22, 2026. Item: Sony WH-1000XM5. Eligible for refund: No (outside 30-day return window)."}]},{"Role":"Assistant","ToolRequests":[],"Contents":[{"Text":"I understand you would like to return your Sony WH-1000XM5 headphones from order ORD-9500. Unfortunately, the order was delivered on January 22, 2026, which means it falls outside our 30-day return window. I am not able to process a refund at this time. However, if the headphones are faulty, they may still be covered under the manufacturer warranty. Would you like me to guide you through the warranty claim process?"}]}]}',
  '{"ToolRequests":[],"Contents":[{"Text":"I understand you would like to return your Sony WH-1000XM5 headphones from order ORD-9500. Unfortunately, the order was delivered on January 22, 2026, which means it falls outside our 30-day return window. I am not able to process a refund at this time. However, if the headphones are faulty, they may still be covered under the manufacturer warranty. Would you like me to guide you through the warranty claim process?"}]}',
  478, 148, 1820, 200, 'stop', NULL, '2026-03-10T09:30:00.0000000+00:00', '2026-03-10T09:30:00.0000000+00:00'
);

-- Trace 13: Order not found
INSERT INTO AgentCallEntity (Id, AgentId, Model, Provider, Request, Response, InputTokens, OutputTokens, DurationMs, HttpStatus, FinishReason, ErrorMessage, CreatedAt, UpdatedAt) VALUES (
  '11000000-0000-0000-0000-000000000013', '10000000-0000-0000-0000-000000000000', 'gpt-4o', 'openai',
  '{"Id":"cc100000-0000-0000-0000-000000000013","Messages":[{"Role":"User","Contents":[{"Text":"Can you look up order ORD-99999 for me please?"}]},{"Role":"Assistant","ToolRequests":[{"Id":"call_e01","Name":"lookup_order","Arguments":"{"order_id":"ORD-99999"}"}],"Contents":[]},{"Role":"Tool","Id":"call_e01","Contents":[{"Text":"call_e01"},{"Text":"Error: Order not found. No order with this ID exists in the system."}]},{"Role":"Assistant","ToolRequests":[],"Contents":[{"Text":"I was unable to find an order with the ID ORD-99999 in our system. Could you double-check the order number? It should be in the confirmation email you received when you placed the order. If you are still having trouble, please let me know the email address associated with your account and I can try to locate your order that way."}]}]}',
  '{"ToolRequests":[],"Contents":[{"Text":"I was unable to find an order with the ID ORD-99999 in our system. Could you double-check the order number? It should be in the confirmation email you received when you placed the order. If you are still having trouble, please let me know the email address associated with your account and I can try to locate your order that way."}]}',
  384, 107, 1310, 200, 'stop', NULL, '2026-03-10T13:45:00.0000000+00:00', '2026-03-10T13:45:00.0000000+00:00'
);

-- Trace 14: Warranty question (no tool call)
INSERT INTO AgentCallEntity (Id, AgentId, Model, Provider, Request, Response, InputTokens, OutputTokens, DurationMs, HttpStatus, FinishReason, ErrorMessage, CreatedAt, UpdatedAt) VALUES (
  '11000000-0000-0000-0000-000000000014', '10000000-0000-0000-0000-000000000000', 'gpt-4o', 'openai',
  '{"Id":"cc100000-0000-0000-0000-000000000014","Messages":[{"Role":"User","Contents":[{"Text":"Do TechShop products come with a warranty?"}]},{"Role":"Assistant","ToolRequests":[],"Contents":[{"Text":"Yes! All products sold at TechShop come with the manufacturer warranty. For Apple products this is typically 1 year, and you can extend it with AppleCare. For Samsung, Sony, and most other brands, you get a 1-2 year warranty. Additionally, TechShop offers an optional extended protection plan that covers accidental damage for up to 3 years. Would you like more details about a warranty for a specific product?"}]}]}',
  '{"ToolRequests":[],"Contents":[{"Text":"Yes! All products sold at TechShop come with the manufacturer warranty. For Apple products this is typically 1 year, and you can extend it with AppleCare. For Samsung, Sony, and most other brands, you get a 1-2 year warranty. Additionally, TechShop offers an optional extended protection plan that covers accidental damage for up to 3 years. Would you like more details about a warranty for a specific product?"}]}',
  218, 93, 870, 200, 'stop', NULL, '2026-03-11T10:10:00.0000000+00:00', '2026-03-11T10:10:00.0000000+00:00'
);

-- Trace 15: Inventory + Stock alert request (uses check_inventory)
INSERT INTO AgentCallEntity (Id, AgentId, Model, Provider, Request, Response, InputTokens, OutputTokens, DurationMs, HttpStatus, FinishReason, ErrorMessage, CreatedAt, UpdatedAt) VALUES (
  '11000000-0000-0000-0000-000000000015', '10000000-0000-0000-0000-000000000000', 'gpt-4o', 'openai',
  '{"Id":"cc100000-0000-0000-0000-000000000015","Messages":[{"Role":"User","Contents":[{"Text":"Is the PlayStation 5 Slim bundle (PRD-9102) available? I have been waiting for months."}]},{"Role":"Assistant","ToolRequests":[{"Id":"call_f01","Name":"check_inventory","Arguments":"{"product_id":"PRD-9102"}"}],"Contents":[]},{"Role":"Tool","Id":"call_f01","Contents":[{"Text":"call_f01"},{"Text":"Out of stock. Next restock: March 20, 2026. Waitlist: 312 customers."}]},{"Role":"Assistant","ToolRequests":[],"Contents":[{"Text":"I completely understand the frustration of waiting! Unfortunately, the PlayStation 5 Slim bundle (PRD-9102) is currently out of stock. The next restock is expected around March 20, 2026, though demand is very high with 312 customers on the waitlist. I strongly recommend signing up for our stock alert so you get notified immediately when inventory is available — that gives you the best chance of securing one. Shall I add your email to the notification list?"}]}]}',
  '{"ToolRequests":[],"Contents":[{"Text":"I completely understand the frustration of waiting! Unfortunately, the PlayStation 5 Slim bundle (PRD-9102) is currently out of stock. The next restock is expected around March 20, 2026, though demand is very high with 312 customers on the waitlist. I strongly recommend signing up for our stock alert so you get notified immediately when inventory is available — that gives you the best chance of securing one. Shall I add your email to the notification list?"}]}',
  401, 142, 1470, 200, 'stop', NULL, '2026-03-12T09:00:00.0000000+00:00', '2026-03-12T09:00:00.0000000+00:00'
);

-- Trace 16: Order status shipped (uses lookup_order)
INSERT INTO AgentCallEntity (Id, AgentId, Model, Provider, Request, Response, InputTokens, OutputTokens, DurationMs, HttpStatus, FinishReason, ErrorMessage, CreatedAt, UpdatedAt) VALUES (
  '11000000-0000-0000-0000-000000000016', '10000000-0000-0000-0000-000000000000', 'gpt-4o', 'openai',
  '{"Id":"cc100000-0000-0000-0000-000000000016","Messages":[{"Role":"User","Contents":[{"Text":"What is the current status of ORD-10456?"}]},{"Role":"Assistant","ToolRequests":[{"Id":"call_g01","Name":"lookup_order","Arguments":"{"order_id":"ORD-10456"}"}],"Contents":[]},{"Role":"Tool","Id":"call_g01","Contents":[{"Text":"call_g01"},{"Text":"Status: Shipped. Carrier: DHL. Tracking: 1234567890. Estimated delivery: March 15, 2026."}]},{"Role":"Assistant","ToolRequests":[],"Contents":[{"Text":"Order ORD-10456 has been shipped via DHL. The tracking number is 1234567890 and delivery is estimated for March 15, 2026. You can track your package on the DHL website. Is there anything else I can help you with?"}]}]}',
  '{"ToolRequests":[],"Contents":[{"Text":"Order ORD-10456 has been shipped via DHL. The tracking number is 1234567890 and delivery is estimated for March 15, 2026. You can track your package on the DHL website. Is there anything else I can help you with?"}]}',
  363, 95, 1150, 200, 'stop', NULL, '2026-03-13T11:20:00.0000000+00:00', '2026-03-13T11:20:00.0000000+00:00'
);

-- Trace 17: Order cancellation request (uses lookup_order + process_refund)
INSERT INTO AgentCallEntity (Id, AgentId, Model, Provider, Request, Response, InputTokens, OutputTokens, DurationMs, HttpStatus, FinishReason, ErrorMessage, CreatedAt, UpdatedAt) VALUES (
  '11000000-0000-0000-0000-000000000017', '10000000-0000-0000-0000-000000000000', 'gpt-4o', 'openai',
  '{"Id":"cc100000-0000-0000-0000-000000000017","Messages":[{"Role":"User","Contents":[{"Text":"I need to cancel my order ORD-10789. I ordered the wrong model."}]},{"Role":"Assistant","ToolRequests":[{"Id":"call_h01","Name":"lookup_order","Arguments":"{"order_id":"ORD-10789"}"}],"Contents":[]},{"Role":"Tool","Id":"call_h01","Contents":[{"Text":"call_h01"},{"Text":"Status: Processing. Ordered: March 13, 2026. Item: Dell XPS 15 i5. Eligible for cancellation: Yes (not yet dispatched)."}]},{"Role":"Assistant","ToolRequests":[{"Id":"call_h02","Name":"process_refund","Arguments":"{"order_id":"ORD-10789","reason":"Customer cancelled - ordered wrong model"}"}],"Contents":[]},{"Role":"Tool","Id":"call_h02","Contents":[{"Text":"call_h02"},{"Text":"Cancellation and refund approved. Confirmation: REF-88901. Amount: $899.00. Processing time: 2-3 business days."}]},{"Role":"Assistant","ToolRequests":[],"Contents":[{"Text":"No problem at all! Your order ORD-10789 for the Dell XPS 15 has been cancelled and a full refund of $899.00 has been initiated (ref REF-88901). The refund should appear on your original payment method within 2-3 business days. If you would like help finding the correct model, I would be happy to assist. Is there anything else I can do for you?"}]}]}',
  '{"ToolRequests":[],"Contents":[{"Text":"No problem at all! Your order ORD-10789 for the Dell XPS 15 has been cancelled and a full refund of $899.00 has been initiated (ref REF-88901). The refund should appear on your original payment method within 2-3 business days. If you would like help finding the correct model, I would be happy to assist. Is there anything else I can do for you?"}]}',
  627, 155, 2380, 200, 'stop', NULL, '2026-03-14T14:00:00.0000000+00:00', '2026-03-14T14:00:00.0000000+00:00'
);

-- Trace 18: Samsung TV inventory check (uses check_inventory)
INSERT INTO AgentCallEntity (Id, AgentId, Model, Provider, Request, Response, InputTokens, OutputTokens, DurationMs, HttpStatus, FinishReason, ErrorMessage, CreatedAt, UpdatedAt) VALUES (
  '11000000-0000-0000-0000-000000000018', '10000000-0000-0000-0000-000000000000', 'gpt-4o', 'openai',
  '{"Id":"cc100000-0000-0000-0000-000000000018","Messages":[{"Role":"User","Contents":[{"Text":"Do you have the Samsung 55-inch Neo QLED in stock? PRD-5531."}]},{"Role":"Assistant","ToolRequests":[{"Id":"call_i01","Name":"check_inventory","Arguments":"{"product_id":"PRD-5531"}"}],"Contents":[]},{"Role":"Tool","Id":"call_i01","Contents":[{"Text":"call_i01"},{"Text":"In stock: 12 units."}]},{"Role":"Assistant","ToolRequests":[],"Contents":[{"Text":"Yes, the Samsung 55-inch Neo QLED (PRD-5531) is in stock with 12 units available. You can order it today and it will ship within 1-2 business days. Would you like to place an order?"}]}]}',
  '{"ToolRequests":[],"Contents":[{"Text":"Yes, the Samsung 55-inch Neo QLED (PRD-5531) is in stock with 12 units available. You can order it today and it will ship within 1-2 business days. Would you like to place an order?"}]}',
  377, 82, 1090, 200, 'stop', NULL, '2026-03-15T10:30:00.0000000+00:00', '2026-03-15T10:30:00.0000000+00:00'
);

-- Trace 19: Delivery address update question (no tool call)
INSERT INTO AgentCallEntity (Id, AgentId, Model, Provider, Request, Response, InputTokens, OutputTokens, DurationMs, HttpStatus, FinishReason, ErrorMessage, CreatedAt, UpdatedAt) VALUES (
  '11000000-0000-0000-0000-000000000019', '10000000-0000-0000-0000-000000000000', 'gpt-4o', 'openai',
  '{"Id":"cc100000-0000-0000-0000-000000000019","Messages":[{"Role":"User","Contents":[{"Text":"Can I change the delivery address on my order after it has been placed?"}]},{"Role":"Assistant","ToolRequests":[],"Contents":[{"Text":"Address changes are possible but depend on the order status. If your order is still being processed and has not yet been dispatched, we can usually update the address. Once an order has been picked up by the carrier, address changes become much harder and may incur additional fees. To change an address, please share your order ID and the new delivery address and I will check whether it is still possible."}]}]}',
  '{"ToolRequests":[],"Contents":[{"Text":"Address changes are possible but depend on the order status. If your order is still being processed and has not yet been dispatched, we can usually update the address. Once an order has been picked up by the carrier, address changes become much harder and may incur additional fees. To change an address, please share your order ID and the new delivery address and I will check whether it is still possible."}]}',
  231, 104, 910, 200, 'stop', NULL, '2026-03-16T08:50:00.0000000+00:00', '2026-03-16T08:50:00.0000000+00:00'
);

-- Trace 20: Refund processing time question (no tool call)
INSERT INTO AgentCallEntity (Id, AgentId, Model, Provider, Request, Response, InputTokens, OutputTokens, DurationMs, HttpStatus, FinishReason, ErrorMessage, CreatedAt, UpdatedAt) VALUES (
  '11000000-0000-0000-0000-000000000020', '10000000-0000-0000-0000-000000000000', 'gpt-4o', 'openai',
  '{"Id":"cc100000-0000-0000-0000-000000000020","Messages":[{"Role":"User","Contents":[{"Text":"I initiated a refund last week. How long does it usually take to appear on my card?"}]},{"Role":"Assistant","ToolRequests":[],"Contents":[{"Text":"Refunds are typically processed within 3-5 business days on our side. However, once released, it can take an additional 2-5 business days for the funds to appear on your statement depending on your bank or card provider. In total, you should expect to see the refund within 5-10 business days from when it was approved. If it has been longer than that, please provide me with your refund confirmation number and I will investigate for you."}]}]}',
  '{"ToolRequests":[],"Contents":[{"Text":"Refunds are typically processed within 3-5 business days on our side. However, once released, it can take an additional 2-5 business days for the funds to appear on your statement depending on your bank or card provider. In total, you should expect to see the refund within 5-10 business days from when it was approved. If it has been longer than that, please provide me with your refund confirmation number and I will investigate for you."}]}',
  227, 116, 890, 200, 'stop', NULL, '2026-03-17T13:00:00.0000000+00:00', '2026-03-17T13:00:00.0000000+00:00'
);

-- Trace 21: Damaged item refund (uses lookup_order + process_refund)
INSERT INTO AgentCallEntity (Id, AgentId, Model, Provider, Request, Response, InputTokens, OutputTokens, DurationMs, HttpStatus, FinishReason, ErrorMessage, CreatedAt, UpdatedAt) VALUES (
  '11000000-0000-0000-0000-000000000021', '10000000-0000-0000-0000-000000000000', 'gpt-4o', 'openai',
  '{"Id":"cc100000-0000-0000-0000-000000000021","Messages":[{"Role":"User","Contents":[{"Text":"Order ORD-10876 arrived and the box was completely crushed. The tablet inside is broken."}]},{"Role":"Assistant","ToolRequests":[{"Id":"call_j01","Name":"lookup_order","Arguments":"{"order_id":"ORD-10876"}"}],"Contents":[]},{"Role":"Tool","Id":"call_j01","Contents":[{"Text":"call_j01"},{"Text":"Status: Delivered. Ordered: March 10, 2026. Item: iPad Air 5th gen. Eligible for refund: Yes (within 30-day window)."}]},{"Role":"Assistant","ToolRequests":[{"Id":"call_j02","Name":"process_refund","Arguments":"{"order_id":"ORD-10876","reason":"Item arrived damaged - packaging crushed, tablet broken"}"}],"Contents":[]},{"Role":"Tool","Id":"call_j02","Contents":[{"Text":"call_j02"},{"Text":"Refund approved. Confirmation: REF-89234. Amount: $749.00. Processing time: 3-5 business days. Express courier collection booked."}]},{"Role":"Assistant","ToolRequests":[],"Contents":[{"Text":"I am so sorry this happened — receiving a damaged item is completely unacceptable. Your full refund of $749.00 has been approved immediately (ref REF-89234) and will reach your account within 3-5 business days. An express courier has been booked to collect the damaged iPad from you. You will receive details by email shortly. Please take a photo of the damaged packaging for your records if you have not already. Is there anything else I can do for you?"}]}]}',
  '{"ToolRequests":[],"Contents":[{"Text":"I am so sorry this happened — receiving a damaged item is completely unacceptable. Your full refund of $749.00 has been approved immediately (ref REF-89234) and will reach your account within 3-5 business days. An express courier has been booked to collect the damaged iPad from you. You will receive details by email shortly. Please take a photo of the damaged packaging for your records if you have not already. Is there anything else I can do for you?"}]}',
  641, 165, 2510, 200, 'stop', NULL, '2026-03-18T10:20:00.0000000+00:00', '2026-03-18T10:20:00.0000000+00:00'
);

-- Trace 22: Multiple product inventory check (uses check_inventory twice)
INSERT INTO AgentCallEntity (Id, AgentId, Model, Provider, Request, Response, InputTokens, OutputTokens, DurationMs, HttpStatus, FinishReason, ErrorMessage, CreatedAt, UpdatedAt) VALUES (
  '11000000-0000-0000-0000-000000000022', '10000000-0000-0000-0000-000000000000', 'gpt-4o', 'openai',
  '{"Id":"cc100000-0000-0000-0000-000000000022","Messages":[{"Role":"User","Contents":[{"Text":"Can you check stock on two items for me? PRD-3310 and PRD-3311."}]},{"Role":"Assistant","ToolRequests":[{"Id":"call_k01","Name":"check_inventory","Arguments":"{"product_id":"PRD-3310"}"}],"Contents":[]},{"Role":"Tool","Id":"call_k01","Contents":[{"Text":"call_k01"},{"Text":"In stock: 8 units."}]},{"Role":"Assistant","ToolRequests":[{"Id":"call_k02","Name":"check_inventory","Arguments":"{"product_id":"PRD-3311"}"}],"Contents":[]},{"Role":"Tool","Id":"call_k02","Contents":[{"Text":"call_k02"},{"Text":"In stock: 0 units. Next restock: April 1, 2026."}]},{"Role":"Assistant","ToolRequests":[],"Contents":[{"Text":"Here is the stock status for both items: PRD-3310 is in stock with 8 units available, so you can order that one today. PRD-3311 is currently out of stock, with a restock expected around April 1, 2026. Would you like me to add you to the waitlist for PRD-3311 and place an order for PRD-3310?"}]}]}',
  '{"ToolRequests":[],"Contents":[{"Text":"Here is the stock status for both items: PRD-3310 is in stock with 8 units available, so you can order that one today. PRD-3311 is currently out of stock, with a restock expected around April 1, 2026. Would you like me to add you to the waitlist for PRD-3311 and place an order for PRD-3310?"}]}',
  512, 128, 2020, 200, 'stop', NULL, '2026-03-19T15:10:00.0000000+00:00', '2026-03-19T15:10:00.0000000+00:00'
);

-- Trace 23: Shipping cost question (no tool call)
INSERT INTO AgentCallEntity (Id, AgentId, Model, Provider, Request, Response, InputTokens, OutputTokens, DurationMs, HttpStatus, FinishReason, ErrorMessage, CreatedAt, UpdatedAt) VALUES (
  '11000000-0000-0000-0000-000000000023', '10000000-0000-0000-0000-000000000000', 'gpt-4o', 'openai',
  '{"Id":"cc100000-0000-0000-0000-000000000023","Messages":[{"Role":"User","Contents":[{"Text":"How much does shipping cost and how long does it take?"}]},{"Role":"Assistant","ToolRequests":[],"Contents":[{"Text":"TechShop offers free standard shipping on all orders over $50. For orders under $50, standard shipping is $4.99. Standard shipping takes 3-5 business days. We also offer express shipping for $9.99, which delivers in 1-2 business days. Same-day delivery is available in select cities for $14.99. All shipping estimates are for US domestic orders. International shipping rates vary by destination."}]}]}',
  '{"ToolRequests":[],"Contents":[{"Text":"TechShop offers free standard shipping on all orders over $50. For orders under $50, standard shipping is $4.99. Standard shipping takes 3-5 business days. We also offer express shipping for $9.99, which delivers in 1-2 business days. Same-day delivery is available in select cities for $14.99. All shipping estimates are for US domestic orders. International shipping rates vary by destination."}]}',
  216, 101, 850, 200, 'stop', NULL, '2026-03-20T11:00:00.0000000+00:00', '2026-03-20T11:00:00.0000000+00:00'
);

-- Trace 24: Order status — out for delivery (uses lookup_order)
INSERT INTO AgentCallEntity (Id, AgentId, Model, Provider, Request, Response, InputTokens, OutputTokens, DurationMs, HttpStatus, FinishReason, ErrorMessage, CreatedAt, UpdatedAt) VALUES (
  '11000000-0000-0000-0000-000000000024', '10000000-0000-0000-0000-000000000000', 'gpt-4o', 'openai',
  '{"Id":"cc100000-0000-0000-0000-000000000024","Messages":[{"Role":"User","Contents":[{"Text":"I am expecting order ORD-11001 today. Any update?"}]},{"Role":"Assistant","ToolRequests":[{"Id":"call_l01","Name":"lookup_order","Arguments":"{"order_id":"ORD-11001"}"}],"Contents":[]},{"Role":"Tool","Id":"call_l01","Contents":[{"Text":"call_l01"},{"Text":"Status: Out for delivery. Driver on route. Estimated delivery window: 2pm-6pm today."}]},{"Role":"Assistant","ToolRequests":[],"Contents":[{"Text":"Your order ORD-11001 is out for delivery today! The driver is currently on route and the estimated delivery window is between 2pm and 6pm. Make sure someone is available to receive it, or you can leave delivery instructions for a safe place. Is there anything else I can help you with?"}]}]}',
  '{"ToolRequests":[],"Contents":[{"Text":"Your order ORD-11001 is out for delivery today! The driver is currently on route and the estimated delivery window is between 2pm and 6pm. Make sure someone is available to receive it, or you can leave delivery instructions for a safe place. Is there anything else I can help you with?"}]}',
  374, 104, 1190, 200, 'stop', NULL, '2026-03-21T12:30:00.0000000+00:00', '2026-03-21T12:30:00.0000000+00:00'
);

-- Trace 25: Partial refund for missing accessory (uses lookup_order + process_refund)
INSERT INTO AgentCallEntity (Id, AgentId, Model, Provider, Request, Response, InputTokens, OutputTokens, DurationMs, HttpStatus, FinishReason, ErrorMessage, CreatedAt, UpdatedAt) VALUES (
  '11000000-0000-0000-0000-000000000025', '10000000-0000-0000-0000-000000000000', 'gpt-4o', 'openai',
  '{"Id":"cc100000-0000-0000-0000-000000000025","Messages":[{"Role":"User","Contents":[{"Text":"My order ORD-10234 came without the charging cable that was listed in the bundle. I want a partial refund for the missing item."}]},{"Role":"Assistant","ToolRequests":[{"Id":"call_m01","Name":"lookup_order","Arguments":"{"order_id":"ORD-10234"}"}],"Contents":[]},{"Role":"Tool","Id":"call_m01","Contents":[{"Text":"call_m01"},{"Text":"Status: Delivered. Item: Laptop Bundle (includes USB-C cable). Missing component eligible for partial refund: Yes."}]},{"Role":"Assistant","ToolRequests":[{"Id":"call_m02","Name":"process_refund","Arguments":"{"order_id":"ORD-10234","reason":"Missing bundle item - USB-C charging cable not included"}"}],"Contents":[]},{"Role":"Tool","Id":"call_m02","Contents":[{"Text":"call_m02"},{"Text":"Partial refund approved. Confirmation: REF-89500. Amount: $29.99. Processing time: 3-5 business days."}]},{"Role":"Assistant","ToolRequests":[],"Contents":[{"Text":"I apologise for the inconvenience of receiving an incomplete bundle. A partial refund of $29.99 for the missing USB-C charging cable has been approved (ref REF-89500) and will be credited to your account within 3-5 business days. Alternatively, we can send you a replacement cable at no charge within 2-3 business days — would you prefer that instead of the refund?"}]}]}',
  '{"ToolRequests":[],"Contents":[{"Text":"I apologise for the inconvenience of receiving an incomplete bundle. A partial refund of $29.99 for the missing USB-C charging cable has been approved (ref REF-89500) and will be credited to your account within 3-5 business days. Alternatively, we can send you a replacement cable at no charge within 2-3 business days — would you prefer that instead of the refund?"}]}',
  634, 148, 2410, 200, 'stop', NULL, '2026-03-22T09:45:00.0000000+00:00', '2026-03-22T09:45:00.0000000+00:00'
);

-- ── Test Cases ────────────────────────────────────────────────────────────────

INSERT INTO TestCaseEntity (Id, Input, ExpectedOutput, CreatedAt, UpdatedAt) VALUES (
  '13000000-0000-0000-0000-000000000001',
  '{"Id":"tc100000-0000-0000-0000-000000000001","Messages":[{"Role":"User","Contents":[{"Text":"What is TechShop return policy?"}]}]}',
  '{"ToolRequests":[],"Contents":[{"Text":"Our return policy allows returns within 30 days of purchase for most electronics. Items must be in original condition with all accessories and packaging included. Refunds are processed within 3-5 business days."}]}',
  '2026-03-01T08:00:00.0000000+00:00', '2026-03-01T08:00:00.0000000+00:00'
);
INSERT INTO TestCaseEntity (Id, Input, ExpectedOutput, CreatedAt, UpdatedAt) VALUES (
  '13000000-0000-0000-0000-000000000002',
  '{"Id":"tc100000-0000-0000-0000-000000000002","Messages":[{"Role":"User","Contents":[{"Text":"How long do refunds take to process?"}]}]}',
  '{"ToolRequests":[],"Contents":[{"Text":"Refunds are processed within 3-5 business days. Once released by TechShop, it may take an additional 2-5 business days to appear on your bank statement depending on your card provider."}]}',
  '2026-03-01T08:00:00.0000000+00:00', '2026-03-01T08:00:00.0000000+00:00'
);
INSERT INTO TestCaseEntity (Id, Input, ExpectedOutput, CreatedAt, UpdatedAt) VALUES (
  '13000000-0000-0000-0000-000000000003',
  '{"Id":"tc100000-0000-0000-0000-000000000003","Messages":[{"Role":"User","Contents":[{"Text":"Can I return an item I bought 6 weeks ago?"}]}]}',
  '{"ToolRequests":[],"Contents":[{"Text":"Unfortunately our standard return window is 30 days from delivery. An item purchased 6 weeks ago would fall outside this window. However, if the item is faulty it may still be covered under the manufacturer warranty."}]}',
  '2026-03-01T08:00:00.0000000+00:00', '2026-03-01T08:00:00.0000000+00:00'
);
INSERT INTO TestCaseEntity (Id, Input, ExpectedOutput, CreatedAt, UpdatedAt) VALUES (
  '13000000-0000-0000-0000-000000000004',
  '{"Id":"tc100000-0000-0000-0000-000000000004","Messages":[{"Role":"User","Contents":[{"Text":"Is free shipping available?"}]}]}',
  '{"ToolRequests":[],"Contents":[{"Text":"Yes, TechShop offers free standard shipping on all orders over $50. Orders under $50 are charged $4.99 for standard shipping. Express and same-day options are available at additional cost."}]}',
  '2026-03-01T08:00:00.0000000+00:00', '2026-03-01T08:00:00.0000000+00:00'
);
INSERT INTO TestCaseEntity (Id, Input, ExpectedOutput, CreatedAt, UpdatedAt) VALUES (
  '13000000-0000-0000-0000-000000000005',
  '{"Id":"tc100000-0000-0000-0000-000000000005","Messages":[{"Role":"User","Contents":[{"Text":"My package was delivered but I did not receive it. What should I do?"}]}]}',
  '{"ToolRequests":[],"Contents":[{"Text":"I am sorry to hear that. Please check with neighbours and any secure delivery locations first. If the package is still missing, I can open a missing parcel investigation with the carrier on your behalf."}]}',
  '2026-03-01T08:00:00.0000000+00:00', '2026-03-01T08:00:00.0000000+00:00'
);
INSERT INTO TestCaseEntity (Id, Input, ExpectedOutput, CreatedAt, UpdatedAt) VALUES (
  '13000000-0000-0000-0000-000000000006',
  '{"Id":"tc100000-0000-0000-0000-000000000006","Messages":[{"Role":"User","Contents":[{"Text":"Do products come with a warranty?"}]}]}',
  '{"ToolRequests":[],"Contents":[{"Text":"Yes, all products sold at TechShop include the manufacturer warranty. Most electronics come with a 1-year warranty. Extended protection plans covering accidental damage for up to 3 years are also available."}]}',
  '2026-03-01T08:00:00.0000000+00:00', '2026-03-01T08:00:00.0000000+00:00'
);

-- ── Test Suite ────────────────────────────────────────────────────────────────

INSERT INTO TestSuiteEntity (Id, Agent, Evaluator, TestCases, CreatedAt, UpdatedAt) VALUES (
  '12000000-0000-0000-0000-000000000000',
  '10000000-0000-0000-0000-000000000000',
  '00000000-0000-0000-0000-000000000004',
  '["13000000-0000-0000-0000-000000000001","13000000-0000-0000-0000-000000000002","13000000-0000-0000-0000-000000000003","13000000-0000-0000-0000-000000000004","13000000-0000-0000-0000-000000000005","13000000-0000-0000-0000-000000000006"]',
  '2026-03-05T08:00:00.0000000+00:00', '2026-03-05T08:00:00.0000000+00:00'
);

-- ── Test Results (shared across runs) ─────────────────────────────────────────

-- Run 1 results: 3 pass, 2 fail, 1 undecided  (Evaluation: 0=Pass, 1=Fail, 2=Undecided)
INSERT INTO TestResultEntity (Id, TestCase, ActualResponse, Evaluation, CreatedAt, UpdatedAt) VALUES (
  '15000000-0000-0000-0000-000000000001', '13000000-0000-0000-0000-000000000001',
  '{"ToolRequests":[],"Contents":[{"Text":"Our return policy allows returns within 30 days of purchase for most electronics. Items must be in original condition with all accessories and packaging included. Refunds are processed within 3-5 business days."}]}',
  0, '2026-03-10T09:00:00.0000000+00:00', '2026-03-10T09:00:00.0000000+00:00'
);
INSERT INTO TestResultEntity (Id, TestCase, ActualResponse, Evaluation, CreatedAt, UpdatedAt) VALUES (
  '15000000-0000-0000-0000-000000000002', '13000000-0000-0000-0000-000000000002',
  '{"ToolRequests":[],"Contents":[{"Text":"Refunds are processed within 5-7 business days on our end, then additional time at your bank."}]}',
  1, '2026-03-10T09:00:00.0000000+00:00', '2026-03-10T09:00:00.0000000+00:00'
);
INSERT INTO TestResultEntity (Id, TestCase, ActualResponse, Evaluation, CreatedAt, UpdatedAt) VALUES (
  '15000000-0000-0000-0000-000000000003', '13000000-0000-0000-0000-000000000003',
  '{"ToolRequests":[],"Contents":[{"Text":"Unfortunately our standard return window is 30 days from delivery. An item purchased 6 weeks ago would fall outside this window. However, if the item is faulty it may still be covered under the manufacturer warranty."}]}',
  0, '2026-03-10T09:00:00.0000000+00:00', '2026-03-10T09:00:00.0000000+00:00'
);
INSERT INTO TestResultEntity (Id, TestCase, ActualResponse, Evaluation, CreatedAt, UpdatedAt) VALUES (
  '15000000-0000-0000-0000-000000000004', '13000000-0000-0000-0000-000000000004',
  '{"ToolRequests":[],"Contents":[{"Text":"Free shipping is available for orders over $75."}]}',
  1, '2026-03-10T09:00:00.0000000+00:00', '2026-03-10T09:00:00.0000000+00:00'
);
INSERT INTO TestResultEntity (Id, TestCase, ActualResponse, Evaluation, CreatedAt, UpdatedAt) VALUES (
  '15000000-0000-0000-0000-000000000005', '13000000-0000-0000-0000-000000000005',
  '{"ToolRequests":[],"Contents":[{"Text":"I am sorry to hear that. Please check with neighbours and any secure delivery locations first. If the package is still missing, I can open a missing parcel investigation with the carrier on your behalf."}]}',
  0, '2026-03-10T09:00:00.0000000+00:00', '2026-03-10T09:00:00.0000000+00:00'
);
INSERT INTO TestResultEntity (Id, TestCase, ActualResponse, Evaluation, CreatedAt, UpdatedAt) VALUES (
  '15000000-0000-0000-0000-000000000006', '13000000-0000-0000-0000-000000000006',
  '{"ToolRequests":[],"Contents":[{"Text":"Products come with the manufacturer warranty. Extended plans are available."}]}',
  2, '2026-03-10T09:00:00.0000000+00:00', '2026-03-10T09:00:00.0000000+00:00'
);

-- Run 2 results: 5 pass, 1 fail  (improved after prompt tuning)
INSERT INTO TestResultEntity (Id, TestCase, ActualResponse, Evaluation, CreatedAt, UpdatedAt) VALUES (
  '15000000-0000-0000-0000-000000000011', '13000000-0000-0000-0000-000000000001',
  '{"ToolRequests":[],"Contents":[{"Text":"Our return policy allows returns within 30 days of purchase for most electronics. Items must be in original condition with all accessories and packaging included. Refunds are processed within 3-5 business days."}]}',
  0, '2026-03-20T09:00:00.0000000+00:00', '2026-03-20T09:00:00.0000000+00:00'
);
INSERT INTO TestResultEntity (Id, TestCase, ActualResponse, Evaluation, CreatedAt, UpdatedAt) VALUES (
  '15000000-0000-0000-0000-000000000012', '13000000-0000-0000-0000-000000000002',
  '{"ToolRequests":[],"Contents":[{"Text":"Refunds are processed within 3-5 business days. Once released by TechShop, it may take an additional 2-5 business days to appear on your bank statement depending on your card provider."}]}',
  0, '2026-03-20T09:00:00.0000000+00:00', '2026-03-20T09:00:00.0000000+00:00'
);
INSERT INTO TestResultEntity (Id, TestCase, ActualResponse, Evaluation, CreatedAt, UpdatedAt) VALUES (
  '15000000-0000-0000-0000-000000000013', '13000000-0000-0000-0000-000000000003',
  '{"ToolRequests":[],"Contents":[{"Text":"Unfortunately our standard return window is 30 days from delivery. An item purchased 6 weeks ago would fall outside this window. However, if the item is faulty it may still be covered under the manufacturer warranty."}]}',
  0, '2026-03-20T09:00:00.0000000+00:00', '2026-03-20T09:00:00.0000000+00:00'
);
INSERT INTO TestResultEntity (Id, TestCase, ActualResponse, Evaluation, CreatedAt, UpdatedAt) VALUES (
  '15000000-0000-0000-0000-000000000014', '13000000-0000-0000-0000-000000000004',
  '{"ToolRequests":[],"Contents":[{"Text":"Yes, TechShop offers free standard shipping on all orders over $50. Orders under $50 are charged $4.99 for standard shipping. Express and same-day options are available at additional cost."}]}',
  0, '2026-03-20T09:00:00.0000000+00:00', '2026-03-20T09:00:00.0000000+00:00'
);
INSERT INTO TestResultEntity (Id, TestCase, ActualResponse, Evaluation, CreatedAt, UpdatedAt) VALUES (
  '15000000-0000-0000-0000-000000000015', '13000000-0000-0000-0000-000000000005',
  '{"ToolRequests":[],"Contents":[{"Text":"I am sorry to hear that. Please check with neighbours and any secure delivery locations first. If the package is still missing, I can open a missing parcel investigation with the carrier on your behalf."}]}',
  0, '2026-03-20T09:00:00.0000000+00:00', '2026-03-20T09:00:00.0000000+00:00'
);
INSERT INTO TestResultEntity (Id, TestCase, ActualResponse, Evaluation, CreatedAt, UpdatedAt) VALUES (
  '15000000-0000-0000-0000-000000000016', '13000000-0000-0000-0000-000000000006',
  '{"ToolRequests":[],"Contents":[{"Text":"Yes, all products include the manufacturer warranty. Most electronics come with a 1-year manufacturer warranty."}]}',
  1, '2026-03-20T09:00:00.0000000+00:00', '2026-03-20T09:00:00.0000000+00:00'
);

-- ── Test Runs ─────────────────────────────────────────────────────────────────

INSERT INTO TestRunEntity (Id, Timestamp, Agent, TestResults, CreatedAt, UpdatedAt) VALUES (
  '14000000-0000-0000-0000-000000000001',
  '2026-03-10T09:00:00.0000000+00:00',
  '10000000-0000-0000-0000-000000000000',
  '["15000000-0000-0000-0000-000000000001","15000000-0000-0000-0000-000000000002","15000000-0000-0000-0000-000000000003","15000000-0000-0000-0000-000000000004","15000000-0000-0000-0000-000000000005","15000000-0000-0000-0000-000000000006"]',
  '2026-03-10T09:00:00.0000000+00:00', '2026-03-10T09:00:00.0000000+00:00'
);

INSERT INTO TestRunEntity (Id, Timestamp, Agent, TestResults, CreatedAt, UpdatedAt) VALUES (
  '14000000-0000-0000-0000-000000000002',
  '2026-03-20T09:00:00.0000000+00:00',
  '10000000-0000-0000-0000-000000000000',
  '["15000000-0000-0000-0000-000000000011","15000000-0000-0000-0000-000000000012","15000000-0000-0000-0000-000000000013","15000000-0000-0000-0000-000000000014","15000000-0000-0000-0000-000000000015","15000000-0000-0000-0000-000000000016"]',
  '2026-03-20T09:00:00.0000000+00:00', '2026-03-20T09:00:00.0000000+00:00'
);
