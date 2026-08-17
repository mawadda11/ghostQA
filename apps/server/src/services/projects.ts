import type { PrismaClient } from "@prisma/client";
import type { ProjectSummary } from "@ghostqa/shared";

import { notFound } from "../api/errors.js";
import { assertTargetUrlAllowed } from "../safety/target-hosts.js";

interface ProjectInput {
  name: string;
  description?: string;
  baseUrl: string;
}

interface ProjectUpdate {
  name?: string;
  description?: string;
  baseUrl?: string;
}

type ProjectWithCount = Awaited<
  ReturnType<PrismaClient["project"]["findFirst"]>
> & {
  _count?: { flows: number; testRuns: number };
};

const toProjectSummary = (project: NonNullable<ProjectWithCount>): ProjectSummary => ({
  id: project.id,
  name: project.name,
  ...(project.description === null ? {} : { description: project.description }),
  baseUrl: project.targetBaseUrl,
  createdAt: project.createdAt.toISOString(),
  updatedAt: project.updatedAt.toISOString(),
  flowCount: project._count?.flows ?? 0,
  runCount: project._count?.testRuns ?? 0,
});

const projectInclude = {
  _count: { select: { flows: true, testRuns: true } },
} as const;

export const createProject = async (
  prisma: PrismaClient,
  input: ProjectInput,
  allowedHosts: ReadonlySet<string>,
): Promise<ProjectSummary> => {
  const target = assertTargetUrlAllowed(input.baseUrl, allowedHosts);
  const project = await prisma.project.create({
    data: {
      name: input.name,
      ...(input.description === undefined
        ? {}
        : { description: input.description }),
      targetBaseUrl: target.href,
    },
    include: projectInclude,
  });
  return toProjectSummary(project);
};

export const listProjects = async (
  prisma: PrismaClient,
): Promise<ProjectSummary[]> =>
  (
    await prisma.project.findMany({
      include: projectInclude,
      orderBy: { createdAt: "desc" },
    })
  ).map(toProjectSummary);

export const getProject = async (
  prisma: PrismaClient,
  projectId: string,
): Promise<ProjectSummary> => {
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    include: projectInclude,
  });
  if (project === null) throw notFound("Project");
  return toProjectSummary(project);
};

export const updateProject = async (
  prisma: PrismaClient,
  projectId: string,
  input: ProjectUpdate,
  allowedHosts: ReadonlySet<string>,
): Promise<ProjectSummary> => {
  await getProject(prisma, projectId);
  const baseUrl =
    input.baseUrl === undefined
      ? undefined
      : assertTargetUrlAllowed(input.baseUrl, allowedHosts).href;
  const project = await prisma.project.update({
    where: { id: projectId },
    data: {
      ...(input.name === undefined ? {} : { name: input.name }),
      ...(input.description === undefined
        ? {}
        : { description: input.description }),
      ...(baseUrl === undefined ? {} : { targetBaseUrl: baseUrl }),
    },
    include: projectInclude,
  });
  return toProjectSummary(project);
};

export const deleteProject = async (
  prisma: PrismaClient,
  projectId: string,
): Promise<void> => {
  await getProject(prisma, projectId);
  await prisma.$transaction(async (transaction) => {
    await transaction.testRun.deleteMany({ where: { projectId } });
    await transaction.project.delete({ where: { id: projectId } });
  });
};
