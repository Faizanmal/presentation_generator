import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Prisma } from '@prisma/client';

export type ApprovalStatus =
  | 'draft'
  | 'pending_review'
  | 'approved'
  | 'rejected'
  | 'changes_requested';
export type WorkflowStage =
  | 'draft'
  | 'internal_review'
  | 'legal_review'
  | 'compliance_review'
  | 'final_approval'
  | 'published';
export type ContentLockType = 'full' | 'partial' | 'none';

export interface ApprovalWorkflow {
  id: string;
  name: string;
  description?: string;
  organizationId: string;
  stages: WorkflowStage[];
  requiredApprovers: Record<
    WorkflowStage,
    {
      minApprovals: number;
      approverRoles: string[];
    }
  >;
  autoPublish: boolean;
  isActive: boolean;
}

export interface ApprovalRequest {
  id: string;
  projectId: string;
  workflowId: string;
  currentStage: WorkflowStage;
  status: ApprovalStatus;
  requestedBy: string;
  requestedAt: Date;
  approvals: Array<{
    stage: WorkflowStage;
    approverId: string;
    approverName: string;
    status: 'approved' | 'rejected' | 'changes_requested';
    comment?: string;
    timestamp: Date;
  }>;
  comments: Array<{
    id: string;
    userId: string;
    userName: string;
    content: string;
    createdAt: Date;
  }>;
}

export interface RequiredDisclaimer {
  id: string;
  organizationId: string;
  name: string;
  content: string;
  placement: 'first_slide' | 'last_slide' | 'all_slides' | 'custom';
  categories: string[];
  isRequired: boolean;
  isActive: boolean;
}

export interface ContentLock {
  id: string;
  projectId: string;
  slideId?: string;
  blockId?: string;
  lockType: ContentLockType;
  reason?: string;
  lockedBy: string;
  lockedAt: Date;
  expiresAt?: Date;
}

interface PrismaWorkflow {
  id: string;
  name: string;
  description: string | null;
  organizationId: string;
  stages: unknown;
  requiredApprovers: unknown;
  autoPublish: boolean;
  isActive: boolean;
}

interface PrismaApprovalRequest {
  id: string;
  projectId: string;
  workflowId: string;
  currentStage: string;
  status: string;
  requestedBy: string;
  requestedAt: Date;
  approvals: unknown;
  comments: unknown;
}

interface PrismaDisclaimer {
  id: string;
  organizationId: string;
  name: string;
  content: string;
  placement: string;
  categories: unknown;
  isRequired: boolean;
  isActive: boolean;
}

interface PrismaContentLock {
  id: string;
  projectId: string;
  slideId: string | null;
  blockId: string | null;
  lockType: string;
  reason: string | null;
  lockedBy: string;
  lockedAt: Date;
  expiresAt: Date | null;
}

interface PrismaPolicy {
  id: string;
  organizationId: string;
  name: string;
  rules: unknown;
  enforcementLevel: string;
  isActive: boolean;
}

export interface PolicyRuleConfig {
  keywords?: string[];
  fields?: string[];
  [key: string]: unknown;
}

export interface GovernancePolicy {
  id: string;
  organizationId: string;
  name: string;
  rules: Array<{
    type:
      | 'required_fields'
      | 'forbidden_content'
      | 'required_disclaimers'
      | 'approval_required';
    config: PolicyRuleConfig;
  }>;
  enforcementLevel: 'warn' | 'block';
  isActive: boolean;
}

@Injectable()
export class ContentGovernanceService {
  private readonly logger = new Logger(ContentGovernanceService.name);

  constructor(private readonly prisma: PrismaService) {}

  // ============================================
  // APPROVAL WORKFLOWS
  // ============================================

  /**
   * Create an approval workflow
   */
  async createWorkflow(
    organizationId: string,
    data: {
      name: string;
      description?: string;
      stages: WorkflowStage[];
      requiredApprovers: Record<
        WorkflowStage,
        { minApprovals: number; approverRoles: string[] }
      >;
      autoPublish?: boolean;
    },
  ): Promise<ApprovalWorkflow> {
    const workflow = await this.prisma.approvalWorkflow.create({
      data: {
        organizationId,
        name: data.name,
        description: data.description,
        stages: data.stages,
        requiredApprovers: data.requiredApprovers,
        autoPublish: data.autoPublish ?? false,
        isActive: true,
      },
    });

    return this.mapWorkflow(workflow);
  }

  /**
   * Submit project for approval
   */
  async submitForApproval(
    projectId: string,
    userId: string,
    workflowId: string,
    message?: string,
  ): Promise<ApprovalRequest> {
    const project = await this.prisma.project.findFirst({
      where: { id: projectId, ownerId: userId },
    });

    if (!project) {
      throw new NotFoundException('Project not found');
    }

    const workflow = await this.prisma.approvalWorkflow.findUnique({
      where: { id: workflowId },
    });

    if (!workflow || !workflow.isActive) {
      throw new NotFoundException('Workflow not found or inactive');
    }

    // Check for existing pending request
    const existing = await this.prisma.approvalRequest.findFirst({
      where: {
        projectId,
        status: { in: ['pending_review', 'changes_requested'] },
      },
    });

    if (existing) {
      throw new BadRequestException(
        'Project already has a pending approval request',
      );
    }

    // Validate content against policies
    const violations = await this.validateContent(projectId);
    if (
      violations.length > 0 &&
      violations.some((v) => v.severity === 'block')
    ) {
      throw new BadRequestException({
        message: 'Content violates governance policies',
        violations,
      });
    }

    const stages = workflow.stages as WorkflowStage[];
    const firstStage = stages[0];

    const request = await this.prisma.approvalRequest.create({
      data: {
        projectId,
        workflowId,
        currentStage: firstStage,
        status: 'pending_review',
        requestedBy: userId,
        approvals: [],
        comments: message
          ? [
              {
                id: this.generateId(),
                userId,
                content: message,
                createdAt: new Date(),
              },
            ]
          : [],
      },
    });

    // Update project status
    await this.prisma.project.update({
      where: { id: projectId },
      data: { approvalStatus: 'pending_review' },
    });

    return this.mapApprovalRequest(request);
  }

  /**
   * Approve or reject at current stage
   */
  async processApproval(
    requestId: string,
    approverId: string,
    action: 'approve' | 'reject' | 'request_changes',
    comment?: string,
  ): Promise<ApprovalRequest> {
    const request = await this.prisma.approvalRequest.findUnique({
      where: { id: requestId },
      include: { workflow: true },
    });

    if (!request) {
      throw new NotFoundException('Approval request not found');
    }

    if (
      request.status !== 'pending_review' &&
      request.status !== 'changes_requested'
    ) {
      throw new BadRequestException('Request is not pending approval');
    }

    // Get approver info
    const approver = await this.prisma.user.findUnique({
      where: { id: approverId },
      select: { id: true, name: true },
    });

    const approvals =
      (request.approvals as unknown as ApprovalRequest['approvals']) || [];
    approvals.push({
      stage: request.currentStage as WorkflowStage,
      approverId,
      approverName: approver?.name || 'Unknown',
      status:
        action === 'approve'
          ? 'approved'
          : action === 'reject'
            ? 'rejected'
            : 'changes_requested',
      comment,
      timestamp: new Date(),
    });

    let newStatus: ApprovalStatus = request.status as ApprovalStatus;
    let newStage: WorkflowStage = request.currentStage as WorkflowStage;

    if (action === 'approve') {
      // Check if stage requirements met
      const stages = request.workflow.stages as WorkflowStage[];
      const requirements = request.workflow.requiredApprovers as Record<
        WorkflowStage,
        { minApprovals: number }
      >;
      const stageRequirement =
        requirements[request.currentStage as WorkflowStage];

      const stageApprovals = approvals.filter(
        (a) => a.stage === request.currentStage && a.status === 'approved',
      );

      if (stageApprovals.length >= stageRequirement.minApprovals) {
        // Move to next stage or complete
        const currentIndex = stages.indexOf(
          request.currentStage as WorkflowStage,
        );

        if (currentIndex === stages.length - 1) {
          newStatus = 'approved';

          // Auto-publish if configured
          if (request.workflow.autoPublish) {
            await this.prisma.project.update({
              where: { id: request.projectId },
              data: { status: 'PUBLISHED', approvalStatus: 'approved' },
            });
          }
        } else {
          newStage = stages[currentIndex + 1];
        }
      }
    } else if (action === 'reject') {
      newStatus = 'rejected';
      await this.prisma.project.update({
        where: { id: request.projectId },
        data: { approvalStatus: 'rejected' },
      });
    } else {
      newStatus = 'changes_requested';
      await this.prisma.project.update({
        where: { id: request.projectId },
        data: { approvalStatus: 'changes_requested' },
      });
    }

    const updated = await this.prisma.approvalRequest.update({
      where: { id: requestId },
      data: {
        currentStage: newStage,
        status: newStatus,
        approvals,
      },
    });

    return this.mapApprovalRequest(updated);
  }

  /**
   * Add comment to approval request
   */
  async addComment(
    requestId: string,
    userId: string,
    content: string,
  ): Promise<ApprovalRequest> {
    const request = await this.prisma.approvalRequest.findUnique({
      where: { id: requestId },
    });

    if (!request) {
      throw new NotFoundException('Approval request not found');
    }

    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { name: true },
    });

    const comments = (request.comments as Array<Record<string, unknown>>) || [];
    comments.push({
      id: this.generateId(),
      userId,
      userName: user?.name || 'Unknown',
      content,
      createdAt: new Date(),
    });

    const updated = await this.prisma.approvalRequest.update({
      where: { id: requestId },
      data: { comments: comments as Prisma.InputJsonValue },
    });

    return this.mapApprovalRequest(updated);
  }

  // ============================================
  // REQUIRED DISCLAIMERS
  // ============================================

  /**
   * Create a required disclaimer
   */
  async createDisclaimer(
    organizationId: string,
    data: {
      name: string;
      content: string;
      placement: RequiredDisclaimer['placement'];
      categories?: string[];
      isRequired?: boolean;
    },
  ): Promise<RequiredDisclaimer> {
    const disclaimer = await this.prisma.requiredDisclaimer.create({
      data: {
        organizationId,
        name: data.name,
        content: data.content,
        placement: data.placement,
        categories: data.categories || [],
        isRequired: data.isRequired ?? true,
        isActive: true,
      },
    });

    return this.mapDisclaimer(disclaimer);
  }

  /**
   * Get applicable disclaimers for a project
   */
  async getApplicableDisclaimers(
    projectId: string,
    organizationId: string,
  ): Promise<RequiredDisclaimer[]> {
    const project = await this.prisma.project.findUnique({
      where: { id: projectId },
      include: { tags: true },
    });

    if (!project) {
      throw new NotFoundException('Project not found');
    }

    const disclaimers = await this.prisma.requiredDisclaimer.findMany({
      where: {
        organizationId,
        isActive: true,
      },
    });

    const projectCategories = project.tags.map((t) => t.name);

    return disclaimers
      .filter((d) => {
        const categories = d.categories as string[];
        return (
          categories.length === 0 ||
          categories.some((c) => projectCategories.includes(c))
        );
      })
      .map((d) => this.mapDisclaimer(d));
  }

  /**
   * Check if project has required disclaimers
   */
  async checkDisclaimers(
    projectId: string,
    organizationId: string,
  ): Promise<{
    valid: boolean;
    missing: RequiredDisclaimer[];
  }> {
    const required = await this.getApplicableDisclaimers(
      projectId,
      organizationId,
    );

    const project = await this.prisma.project.findUnique({
      where: { id: projectId },
      include: {
        slides: {
          include: { blocks: true },
          orderBy: { order: 'asc' },
        },
      },
    });

    if (!project) {
      throw new NotFoundException('Project not found');
    }

    const missing: RequiredDisclaimer[] = [];

    for (const disclaimer of required.filter((d) => d.isRequired)) {
      let found = false;

      for (const slide of project.slides) {
        for (const block of slide.blocks) {
          const content = JSON.stringify(block.content || {});
          if (content.includes(disclaimer.content.substring(0, 50))) {
            found = true;
            break;
          }
        }
        if (found) break;
      }

      if (!found) {
        missing.push(disclaimer);
      }
    }

    return {
      valid: missing.length === 0,
      missing,
    };
  }

  // ============================================
  // CONTENT LOCKS
  // ============================================

  /**
   * Lock content from editing
   */
  async lockContent(
    projectId: string,
    userId: string,
    options: {
      slideId?: string;
      blockId?: string;
      lockType: ContentLockType;
      reason?: string;
      expiresAt?: Date;
    },
  ): Promise<ContentLock> {
    const lock = await this.prisma.contentLock.create({
      data: {
        projectId,
        slideId: options.slideId,
        blockId: options.blockId,
        lockType: options.lockType,
        reason: options.reason,
        lockedBy: userId,
        expiresAt: options.expiresAt,
      },
    });

    return this.mapContentLock(lock);
  }

  /**
   * Unlock content
   */
  async unlockContent(lockId: string, userId: string): Promise<void> {
    const lock = await this.prisma.contentLock.findUnique({
      where: { id: lockId },
    });

    if (!lock) {
      throw new NotFoundException('Lock not found');
    }

    if (lock.lockedBy !== userId) {
      // Check if user has admin rights
      const hasAdminRights = await this.checkAdminRights(
        userId,
        lock.projectId,
      );
      if (!hasAdminRights) {
        throw new ForbiddenException(
          'You cannot unlock content locked by another user',
        );
      }
    }

    await this.prisma.contentLock.delete({
      where: { id: lockId },
    });
  }

  /**
   * Check if content is locked
   */
  async isContentLocked(
    projectId: string,
    slideId?: string,
    blockId?: string,
  ): Promise<ContentLock | null> {
    const lock = await this.prisma.contentLock.findFirst({
      where: {
        projectId,
        OR: [
          { lockType: 'full' },
          { slideId, lockType: { in: ['full', 'partial'] } },
          { blockId },
        ],
        AND: [
          {
            OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
          },
        ],
      },
    });

    return lock ? this.mapContentLock(lock) : null;
  }

  // ============================================
  // GOVERNANCE POLICIES
  // ============================================

  /**
   * Create governance policy
   */
  async createPolicy(
    organizationId: string,
    data: {
      name: string;
      rules: GovernancePolicy['rules'];
      enforcementLevel: 'warn' | 'block';
    },
  ): Promise<GovernancePolicy> {
    const policy = await this.prisma.governancePolicy.create({
      data: {
        organizationId,
        name: data.name,
        rules: data.rules as unknown as Prisma.InputJsonValue,
        enforcementLevel: data.enforcementLevel,
        isActive: true,
      },
    });

    return this.mapPolicy(policy);
  }

  /**
   * Validate content against policies
   */
  async validateContent(projectId: string): Promise<
    Array<{
      policyId: string;
      policyName: string;
      ruleType: string;
      message: string;
      severity: 'warn' | 'block';
      location?: { slideId?: string; blockId?: string };
    }>
  > {
    const project = await this.prisma.project.findUnique({
      where: { id: projectId },
      include: {
        slides: {
          include: { blocks: true },
        },
        owner: {
          include: {
            organizationMembers: {
              include: { organization: true },
            },
          },
        },
      },
    });

    if (!project) {
      throw new NotFoundException('Project not found');
    }

    const organizationId = project.owner.organizationMembers[0]?.organizationId;
    if (!organizationId) {
      return [];
    }

    const policies = await this.prisma.governancePolicy.findMany({
      where: {
        organizationId,
        isActive: true,
      },
    });

    const violations: Array<{
      policyId: string;
      policyName: string;
      ruleType: string;
      message: string;
      severity: 'warn' | 'block';
      location?: { slideId?: string; blockId?: string };
    }> = [];

    for (const policy of policies) {
      const rules = policy.rules as GovernancePolicy['rules'];

      for (const rule of rules) {
        switch (rule.type) {
          case 'forbidden_content':
            for (const slide of project.slides) {
              for (const block of slide.blocks) {
                const content = JSON.stringify(
                  block.content || {},
                ).toLowerCase();
                for (const forbidden of rule.config.keywords || []) {
                  if (content.includes(forbidden.toLowerCase())) {
                    violations.push({
                      policyId: policy.id,
                      policyName: policy.name,
                      ruleType: rule.type,
                      message: `Contains forbidden content: "${forbidden}"`,
                      severity: policy.enforcementLevel as 'warn' | 'block',
                      location: { slideId: slide.id, blockId: block.id },
                    });
                  }
                }
              }
            }
            break;

          case 'required_fields':
            for (const field of rule.config.fields || []) {
              const hasField = project.slides.some((s) =>
                s.blocks.some((b) => {
                  const content = JSON.stringify(b.content || {});
                  return content.includes(field);
                }),
              );
              if (!hasField) {
                violations.push({
                  policyId: policy.id,
                  policyName: policy.name,
                  ruleType: rule.type,
                  message: `Missing required field: "${field}"`,
                  severity: policy.enforcementLevel as 'warn' | 'block',
                });
              }
            }
            break;

          case 'approval_required':
            if (project.status === 'PUBLISHED' && !project.approvalStatus) {
              violations.push({
                policyId: policy.id,
                policyName: policy.name,
                ruleType: rule.type,
                message: 'Publishing requires approval',
                severity: policy.enforcementLevel as 'warn' | 'block',
              });
            }
            break;
        }
      }
    }

    return violations;
  }

  /**
   * Get organization workflows
   */
  async getOrganizationWorkflows(
    organizationId: string,
  ): Promise<ApprovalWorkflow[]> {
    const workflows = await this.prisma.approvalWorkflow.findMany({
      where: { organizationId, isActive: true },
    });

    return workflows.map((w) => this.mapWorkflow(w));
  }

  /**
   * Get project approval history
   */
  async getApprovalHistory(projectId: string): Promise<ApprovalRequest[]> {
    const requests = await this.prisma.approvalRequest.findMany({
      where: { projectId },
      orderBy: { requestedAt: 'desc' },
    });

    return requests.map((r) => this.mapApprovalRequest(r));
  }

  // Helper methods
  private generateId(): string {
    return `${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private async checkAdminRights(
    userId: string,
    projectId: string,
  ): Promise<boolean> {
    const project = await this.prisma.project.findUnique({
      where: { id: projectId },
      include: {
        owner: {
          include: {
            organizationMembers: true,
          },
        },
      },
    });

    if (project?.ownerId === userId) return true;

    const membership = project?.owner.organizationMembers.find(
      (m) => m.role === 'OWNER' || m.role === 'ADMIN',
    );

    return !!membership;
  }

  private mapWorkflow(w: PrismaWorkflow): ApprovalWorkflow {
    return {
      id: w.id,
      name: w.name,
      description: w.description ?? undefined,
      organizationId: w.organizationId,
      stages: w.stages as WorkflowStage[],
      requiredApprovers: w.requiredApprovers as Record<
        WorkflowStage,
        { minApprovals: number; approverRoles: string[] }
      >,
      autoPublish: w.autoPublish,
      isActive: w.isActive,
    };
  }

  private mapApprovalRequest(r: PrismaApprovalRequest): ApprovalRequest {
    return {
      id: r.id,
      projectId: r.projectId,
      workflowId: r.workflowId,
      currentStage: r.currentStage as WorkflowStage,
      status: r.status as ApprovalStatus,
      requestedBy: r.requestedBy,
      requestedAt: r.requestedAt,
      approvals: r.approvals as ApprovalRequest['approvals'],
      comments: r.comments as ApprovalRequest['comments'],
    };
  }

  private mapDisclaimer(d: PrismaDisclaimer): RequiredDisclaimer {
    return {
      id: d.id,
      organizationId: d.organizationId,
      name: d.name,
      content: d.content,
      placement: d.placement as RequiredDisclaimer['placement'],
      categories: d.categories as string[],
      isRequired: d.isRequired,
      isActive: d.isActive,
    };
  }

  private mapContentLock(l: PrismaContentLock): ContentLock {
    return {
      id: l.id,
      projectId: l.projectId,
      slideId: l.slideId ?? undefined,
      blockId: l.blockId ?? undefined,
      lockType: l.lockType as ContentLockType,
      reason: l.reason ?? undefined,
      lockedBy: l.lockedBy,
      lockedAt: l.lockedAt,
      expiresAt: l.expiresAt ?? undefined,
    };
  }

  private mapPolicy(p: PrismaPolicy): GovernancePolicy {
    return {
      id: p.id,
      organizationId: p.organizationId,
      name: p.name,
      rules: p.rules as GovernancePolicy['rules'],
      enforcementLevel: p.enforcementLevel as 'warn' | 'block',
      isActive: p.isActive,
    };
  }
}
